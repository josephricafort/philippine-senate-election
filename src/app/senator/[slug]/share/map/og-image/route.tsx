import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import {
  buildSenatorList, candidateMunicipalitySwingHeadline, candidateTopProvincesHeadline, resolveShareYearPair,
} from '@/lib/data';
import { buildMunicipalityPaths } from '@/lib/map-svg-server';
import { GAIN, LOSS, NEUTRAL, swingBucketColor, swingMaxAbs, wordIsNumeric } from '@/lib/swing';
import { yearColor } from '@/lib/year-colors';
import { siteUrlFromHeaders } from '@/lib/site';
import { loadOgFonts } from '@/lib/og-fonts';

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
  const fonts = await loadOgFonts();

  const fallback = (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0a', color: '#fafafa', fontSize: 40,
        fontFamily: 'Source Serif',
      }}
    >
      BotoSenado
    </div>
  );

  if (!senator) return new ImageResponse(fallback, { ...SIZE, fonts });

  const candidate = await loadCandidateDataServer(senator.senator_id);

  const pair = resolveShareYearPair(senator, { yearA, yearB });
  const result = pair && candidate.years[String(pair[0])] && candidate.years[String(pair[1])]
    ? candidateMunicipalitySwingHeadline(candidate, senator, pair[0], pair[1])
    : null;

  if (!result) {
    // No swing data (single-run candidate, or zero comparable municipalities for the resolved
    // year pair) — there's no meaningful "map" to draw without a second year to diff against,
    // so this falls back to the same "top provinces by vote share" card the province-swing
    // og-image uses, rather than a blank/generic card. See candidateTopProvincesHeadline for
    // why this can't return null for any candidate with real votes.
    const latestYear = Math.max(...senator.years);
    const topResult = candidateTopProvincesHeadline(candidate, senator, latestYear);
    if (!topResult) return new ImageResponse(fallback, { ...SIZE, fonts });

    const maxShare = Math.max(...topResult.rows.map(r => r.vote_share), 0.0001);
    const barColor = yearColor(latestYear);
    // Full top-15 (not 10) — matched to the swing card's row count/height so both cards read as
    // the same chart family instead of the top-provinces card looking sparser by comparison.
    const topRows = topResult.rows.slice(0, 15);

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%', display: 'flex', background: '#0a0a0a', color: '#fafafa',
            padding: '48px 56px', fontFamily: 'Source Sans',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: 356, marginRight: 40 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 40, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
              {topResult.headline.split(' ').filter(word => word !== '').map((word, i) => (
                <span key={i} style={{ display: 'flex', whiteSpace: 'pre', fontFamily: wordIsNumeric(word) ? 'Source Code' : 'Source Sans' }}>
                  {`${word} `}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 'auto', paddingTop: 24, borderTop: '2px solid rgba(255,255,255,0.1)', gap: 8 }}>
              <span style={{ display: 'flex', fontSize: 24, color: '#fafafa', fontWeight: 600 }}>
                Explore all senate election data since 2007 up to present —
              </span>
              <span style={{ display: 'flex', fontFamily: 'Source Code', fontSize: 24, color: '#a1a1aa' }}>
                {siteUrlFromHeaders(request.headers).replace(/^https?:\/\//, '')}
              </span>
            </div>
          </div>

          {/* Same tick-header + name/bar/value row shape as the province-swing card's right
              column — 0/mid/max labels instead of −max/0/+max since share has no negative
              side, same 180px name column and 82px value column so both card types line up. */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', width: 180 }} />
              <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', fontSize: 15, color: '#71717a', fontFamily: 'Source Code' }}>
                <span style={{ display: 'flex' }}>0%</span>
                <span style={{ display: 'flex' }}>{`${(maxShare * 100 / 2).toFixed(0)}%`}</span>
                <span style={{ display: 'flex' }}>{`${(maxShare * 100).toFixed(0)}%`}</span>
              </div>
              <div style={{ display: 'flex', width: 82 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              {topRows.map(row => {
                const widthPct = (row.vote_share / maxShare) * 100;
                return (
                  <div key={row.adm2_en} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 22 }}>
                    <div style={{ display: 'flex', width: 180, fontSize: 18, lineHeight: 1.2, color: '#fafafa', justifyContent: 'flex-end', textAlign: 'right' }}>
                      {row.adm2_en}
                    </div>
                    <div style={{ display: 'flex', flex: 1, height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 5, position: 'relative' }}>
                      <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, bottom: 0, width: `${widthPct}%`, background: barColor, borderRadius: 3 }} />
                    </div>
                    <div style={{ display: 'flex', width: 82, fontFamily: 'Source Code', fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
                      {(row.vote_share * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
      { ...SIZE, fonts, headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
      } }
    );
  }

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
  // the render cost.
  //
  // Deliberately NOT setting Vary: Host here even though the rendered footer text embeds the
  // requesting domain (see siteUrlFromHeaders below) — Vercel's CDN was staying MISS on every
  // repeat request to the identical URL with Vary set, and CDNs (Vercel included, per reports
  // in vercel/next.js discussions) are known to skip/limit caching for responses carrying a
  // Vary header on anything beyond Accept-Encoding. The tradeoff: a cached image's footer text
  // reflects whichever domain rendered it first, until the cache expires/revalidates — acceptable
  // while only one domain (this Vercel URL) is actually in use; revisit once botosenado.ph is
  // back online and both domains serve real traffic simultaneously.
  const headers = {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=86400',
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
          fontFamily: 'Source Sans',
        }}
      >
        {/* Left column: headline + footer — now 2/3 of the canvas width (flex: 1 against the
            map's fixed 360px), with a larger headline to fill the extra room. Each word gets
            its own font on top of its own emphasis color — Source Code for any word touching
            a digit (counts, percentages, years), Source Sans for the surrounding prose. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 40 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 52, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
            {result.headlineParts.flatMap((part, i) =>
              part.text.split(' ').filter(word => word !== '').map((word, j) => (
                <span
                  key={`${i}-${j}`}
                  style={{
                    display: 'flex',
                    whiteSpace: 'pre',
                    fontFamily: wordIsNumeric(word) ? 'Source Code' : 'Source Sans',
                    color: part.emphasis === 'loss' ? LOSS : part.emphasis === 'gain' ? GAIN : part.emphasis === 'flat' ? NEUTRAL : '#fafafa',
                  }}
                >
                  {`${word} `}
                </span>
              ))
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 'auto', paddingTop: 24, borderTop: '2px solid rgba(255,255,255,0.1)', gap: 8 }}>
            <span style={{ display: 'flex', fontSize: 24, color: '#fafafa', fontWeight: 600 }}>
              Explore all senate election data since 2007 up to present —
            </span>
            <span style={{ display: 'flex', fontFamily: 'Source Code', fontSize: 24, color: '#a1a1aa' }}>
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
    { ...SIZE, headers, fonts }
  );
}
