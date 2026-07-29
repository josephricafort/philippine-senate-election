import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateProvinceSwingHeadline, resolveShareYearPair } from '@/lib/data';
import { GAIN, LOSS, swingColor, formatSwingPt } from '@/lib/swing';
import { siteUrlFromHeaders } from '@/lib/site';

// A Route Handler rather than the opengraph-image.tsx file convention — that convention's
// Image() function only receives `params` (dynamic route segments) in this Next.js version, not
// `searchParams`, so it can't see which year pair the user selected via SwingYearPairSelector
// before clicking Share. A plain Request gives full access to the query string.
//
// Landscape 1200x630 (Open Graph's standard link-preview ratio) rather than portrait — Facebook,
// X, etc. render og:image inside a fixed landscape frame and crop portrait images to fit it,
// which cut off the headline and top rows here when this was 1080x1350.
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

  const result = candidateProvinceSwingHeadline(candidate, senator, resolvedYearA, resolvedYearB);
  if (!result) return new ImageResponse(fallback, SIZE);

  const maxAbsDelta = Math.max(...result.sample.map(s => Math.abs(s.delta)), 0.01);

  // Same reasoning as the map og-image route: Vercel doesn't reliably reuse warm instances
  // between requests to this route, so every cold invocation was measured slow enough in
  // production (a few seconds, occasionally spiking well past that) that X's link-preview
  // crawler was leaving the card image empty. Plain Cache-Control's s-maxage does NOT get
  // Vercel's CDN to actually cache a Function response — confirmed in production (x-vercel-cache
  // stayed MISS on repeat requests to the identical URL) and documented at
  // vercel.com/docs/caching/cdn-cache: "If you set Cache-Control without a CDN-Cache-Control,
  // the Vercel CDN strips s-maxage and stale-while-revalidate from the response". CDN-Cache-Control
  // is the header Vercel actually reads to cache Function responses at the edge.
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
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left column: headline + footer — fixed at 1/3 of the canvas width. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 356, marginRight: 40 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 40, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
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

        {/* Right column: the province swing bars — fixed at 2/3 of the canvas width, row count
            (see candidateProvinceSwingHeadline's sample size) chosen to fill the height. */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', width: 180 }} />
            <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', fontSize: 15, color: '#71717a', fontFamily: 'monospace' }}>
              <span style={{ display: 'flex' }}>{`−${(maxAbsDelta * 100).toFixed(0)}pt`}</span>
              <span style={{ display: 'flex' }}>0</span>
              <span style={{ display: 'flex' }}>{`+${(maxAbsDelta * 100).toFixed(0)}pt`}</span>
            </div>
            <div style={{ display: 'flex', width: 82 }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            {result.sample.map(row => {
              const gain = row.delta >= 0;
              const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 100;
              const color = swingColor(row.delta);
              return (
                <div key={row.adm2_en} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 22 }}>
                  <div style={{ display: 'flex', width: 180, fontSize: 18, lineHeight: 1.2, color: '#fafafa', justifyContent: 'flex-end', textAlign: 'right' }}>
                    {row.adm2_en}
                  </div>
                  <div style={{ display: 'flex', flex: 1, height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 5, position: 'relative' }}>
                    <div style={{ display: 'flex', position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
                    <div
                      style={gain ? {
                        display: 'flex',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        width: `${widthPct / 2}%`,
                        background: color,
                        borderRadius: 3,
                      } : {
                        display: 'flex',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: '50%',
                        width: `${widthPct / 2}%`,
                        background: color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', width: 82, fontSize: 16, fontWeight: 700, color }}>
                    {formatSwingPt(row.delta)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),
    { ...SIZE, headers }
  );
}
