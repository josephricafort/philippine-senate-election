import { ImageResponse } from 'next/og';
import { loadCandidateIndexServer, loadAllVotesServer } from '@/lib/data-server';
import { buildSenatorList, provinceSwingHeadline, resolveShareYearPair } from '@/lib/data';
import { GAIN, LOSS, formatSwingPt } from '@/lib/swing';

export const alt = 'Philippine Senate Election Explorer — Province swing';
export const size = { width: 1080, height: 1350 };
export const contentType = 'image/png';

export default async function Image({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ yearA?: string; yearB?: string }>;
}) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const index = await loadCandidateIndexServer();
  const senator = buildSenatorList(index).find(s => s.senator_id === slug);

  const fallback = (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0a', color: '#fafafa', fontSize: 40,
      }}
    >
      Philippine Senate Election Explorer
    </div>
  );

  if (!senator) return new ImageResponse(fallback, size);

  const voteCache = await loadAllVotesServer();
  const pair = resolveShareYearPair(senator, query);
  if (!pair) return new ImageResponse(fallback, size);
  const [yearA, yearB] = pair;
  const voteDataA = voteCache.get(yearA);
  const voteDataB = voteCache.get(yearB);
  if (!voteDataA || !voteDataB) return new ImageResponse(fallback, size);

  const result = provinceSwingHeadline(voteDataA, voteDataB, senator, yearA, yearB);
  if (!result) return new ImageResponse(fallback, size);

  const maxAbsDelta = Math.max(...result.sample.map(s => Math.abs(s.delta)), 0.01);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          color: '#fafafa',
          padding: '76px 64px 64px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 58, fontWeight: 700, lineHeight: 1.22, letterSpacing: -1 }}>
          {result.headlineParts.flatMap((part, i) =>
            part.text.split(' ').map((word, j) => (
              <span key={`${i}-${j}`} style={{ display: 'flex', whiteSpace: 'pre', color: part.emphasis === 'loss' ? LOSS : part.emphasis === 'gain' ? GAIN : '#fafafa' }}>
                {word === '' ? ' ' : `${word} `}
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 20 }}>
          <div style={{ display: 'flex', width: 240 }} />
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', fontSize: 22, color: '#71717a', fontFamily: 'monospace' }}>
            <span style={{ display: 'flex' }}>{`−${(maxAbsDelta * 100).toFixed(0)}pt`}</span>
            <span style={{ display: 'flex' }}>0</span>
            <span style={{ display: 'flex' }}>{`+${(maxAbsDelta * 100).toFixed(0)}pt`}</span>
          </div>
          <div style={{ display: 'flex', width: 128 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 12 }}>
          {result.sample.map((row, i) => {
            const gain = row.delta >= 0;
            const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 100;
            const color = gain ? GAIN : LOSS;
            const dim = i !== 0;
            return (
              <div key={row.adm2_en} style={{ display: 'flex', alignItems: 'center', gap: 24, minHeight: 40 }}>
                <div style={{ display: 'flex', width: 240, fontSize: 30, lineHeight: 1.2, color: dim ? '#71717a' : '#fafafa', justifyContent: 'flex-end', textAlign: 'right' }}>
                  {row.adm2_en}
                </div>
                <div style={{ display: 'flex', flex: 1, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 8, position: 'relative' }}>
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
                      opacity: dim ? 0.55 : 1,
                      borderRadius: 4,
                    } : {
                      display: 'flex',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: '50%',
                      width: `${widthPct / 2}%`,
                      background: color,
                      opacity: dim ? 0.55 : 1,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', width: 128, fontSize: 30, fontWeight: 700, color, opacity: dim ? 0.65 : 1 }}>
                  {formatSwingPt(row.delta)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', paddingTop: 40, borderTop: '2px solid rgba(255,255,255,0.1)', fontSize: 28, color: '#a1a1aa', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', whiteSpace: 'pre' }}>{'Steepest in '}</span>
            <span style={{ display: 'flex', whiteSpace: 'pre', color: '#fafafa', fontWeight: 600 }}>{result.biggestMove.adm2_en}</span>
            <span style={{ display: 'flex', whiteSpace: 'pre' }}>{`, where ${result.biggestMove.delta >= 0 ? 'support rose' : 'support fell'} to `}</span>
            <span style={{ display: 'flex', whiteSpace: 'pre', color: '#fafafa', fontWeight: 600 }}>
              {`${(result.biggestMove.shareA * 100).toFixed(1)}% → ${(result.biggestMove.shareB * 100).toFixed(1)}%`}
            </span>
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#fafafa', fontWeight: 600, marginTop: 20 }}>
            Explore all senate election data since 2007 up to present
          </div>
          <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 24, color: '#71717a', marginTop: 10 }}>
            {`senate-explorer.ph/senator/${senator.senator_id}`}
          </div>
        </div>
      </div>
    ),
    size
  );
}
