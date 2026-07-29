import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateMunicipalitySwingHeadline, resolveShareYearPair } from '@/lib/data';
import { buildMunicipalityPaths } from '@/lib/map-svg-server';
import { GAIN, LOSS, swingBucketColor, swingMaxAbs } from '@/lib/swing';
import { siteUrlFromHeaders } from '@/lib/site';

// Same Route Handler reasoning as the province-swing og-image: needs searchParams (yearA/yearB),
// which the opengraph-image.tsx file convention can't see in this Next.js version.
// Landscape 1200x630 to match the province-swing card and every other OG image on the site.
const SIZE = { width: 1200, height: 630 };

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const yearA = request.nextUrl.searchParams.get('yearA') ?? undefined;
  const yearB = request.nextUrl.searchParams.get('yearB') ?? undefined;

  const index = await loadCandidateIndexServer();
  const senator = buildSenatorList(index).find(s => s.senator_id === slug);

  const fallback = (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0a', color: '#fafafa', fontSize: 40,
      }}
    >
      BotoSenado
    </div>
  );

  if (!senator) return new ImageResponse(fallback, SIZE);

  const pair = resolveShareYearPair(senator, { yearA, yearB });
  if (!pair) return new ImageResponse(fallback, SIZE);
  const [resolvedYearA, resolvedYearB] = pair;
  const candidate = await loadCandidateDataServer(senator.senator_id);
  if (!candidate.years[String(resolvedYearA)] || !candidate.years[String(resolvedYearB)]) {
    return new ImageResponse(fallback, SIZE);
  }

  const result = candidateMunicipalitySwingHeadline(candidate, senator, resolvedYearA, resolvedYearB);
  if (!result) return new ImageResponse(fallback, SIZE);

  // Map column is a narrow 1/3 of the canvas — this card leads with the headline (2/3 of the
  // width), unlike the province-swing card's wider bar-chart column, since the map itself reads
  // fine small while the claim needs the room. 'cover' fit fills the column edge-to-edge (the
  // map's tall north-south shape overflows top/bottom and gets clipped) rather than letterboxing.
  const mapWidth = 360;
  const mapHeight = SIZE.height - 96; // minus top/bottom padding
  const { paths } = await buildMunicipalityPaths(mapWidth, mapHeight, 'cover');
  const maxAbs = swingMaxAbs(result.swingByPsgc);

  // Rendering this (topology parsing + per-polygon simplification, see map-svg-server.ts) takes
  // ~2-3s on a cold serverless instance, and Vercel doesn't reliably reuse warm instances between
  // requests here — X's link-preview crawler doesn't wait that long and was leaving the card
  // image empty. Plain Cache-Control's s-maxage does NOT get Vercel's CDN to actually cache a
  // Function response — confirmed in production (x-vercel-cache stayed MISS on repeat requests
  // to the identical URL) and documented at vercel.com/docs/caching/cdn-cache: "If you set
  // Cache-Control without a CDN-Cache-Control, the Vercel CDN strips s-maxage and
  // stale-while-revalidate from the response". CDN-Cache-Control is the header Vercel actually
  // reads to cache Function responses at the edge — only the very first fetch per URL then pays
  // the render cost. Vary: Host because the rendered footer text embeds the requesting domain
  // (see siteUrlFromHeaders below) — without it, a cache hit from one domain could serve
  // another domain's footer text.
  const headers = {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
    'Vary': 'Host, X-Forwarded-Host',
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: '48px 56px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left column: headline + footer — now 2/3 of the canvas width (flex: 1 against the
            map's fixed 360px), with a larger headline to fill the extra room. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 40 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 52, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
            {result.headlineParts.flatMap((part, i) =>
              part.text.split(' ').filter(word => word !== '').map((word, j) => (
                <span key={`${i}-${j}`} style={{ display: 'flex', whiteSpace: 'pre', color: part.emphasis === 'loss' ? LOSS : part.emphasis === 'gain' ? GAIN : '#fafafa' }}>
                  {`${word} `}
                </span>
              ))
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 'auto', paddingTop: 24, borderTop: '2px solid rgba(255,255,255,0.1)', gap: 8 }}>
            <span style={{ display: 'flex', fontSize: 24, color: '#fafafa', fontWeight: 600 }}>
              Explore all senate election data since 2007 up to present —
            </span>
            <span style={{ display: 'flex', fontFamily: 'monospace', fontSize: 24, color: '#a1a1aa' }}>
              {siteUrlFromHeaders(request.headers).replace(/^https?:\/\//, '')}
            </span>
          </div>
        </div>

        {/* Right column: the swing map itself — every municipality polygon painted with the
            same 10-bucket color scale as the live interactive map (see lib/swing.ts). No inner
            padding — 'cover' fit already scales the map to fill this box exactly, so wrapping
            padding here would just shrink it back down and reintroduce empty margin. */}
        <div style={{ display: 'flex', width: mapWidth, height: mapHeight, overflow: 'hidden' }}>
          <svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
            {paths.map(({ psgc, d }) => {
              const entry = result.swingByPsgc.get(psgc);
              const color = entry ? swingBucketColor(entry.delta, maxAbs) : '#27272a';
              return <path key={psgc} d={d} fill={color} stroke="#0a0a0a" strokeWidth={0.4} />;
            })}
          </svg>
        </div>
      </div>
    ),
    { ...SIZE, headers }
  );
}
