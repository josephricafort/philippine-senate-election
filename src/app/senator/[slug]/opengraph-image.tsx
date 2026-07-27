import { ImageResponse } from 'next/og';
import { loadCandidateIndexServer, loadAllVotesServer } from '@/lib/data-server';
import { buildSenatorList, topProvinces, trendData } from '@/lib/data';
import { yearColor } from '@/lib/year-colors';
import type { ElectionYear } from '@/lib/types';

export const alt = 'Philippine Senate Election Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function formatVotes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const index = await loadCandidateIndexServer();
  const senator = buildSenatorList(index).find(s => s.senator_id === slug);

  if (!senator) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: '#0a0a0a', color: '#fafafa', fontSize: 48,
          }}
        >
          Philippine Senate Election Explorer
        </div>
      ),
      size
    );
  }

  const voteCache = await loadAllVotesServer();
  const latestYear = Math.max(...senator.years) as ElectionYear;
  const latestVoteData = voteCache.get(latestYear) ?? null;
  const national = latestVoteData?.national[senator.senator_id];
  const topProvince = latestVoteData ? topProvinces(latestVoteData, senator.senator_id, 1)[0] : null;
  const trend = trendData(voteCache, senator.senator_id);

  const maxShare = Math.max(...trend.map(t => t.vote_share), 0.01);

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
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, color: '#a1a1aa' }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: yearColor(latestYear), display: 'flex' }} />
          Philippine Senate Election Explorer &middot; {latestYear}
        </div>

        {/* Name */}
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, marginTop: 28, lineHeight: 1.05, letterSpacing: -1.5 }}>
          {senator.senator_name}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 56, marginTop: 48 }}>
          {national ? (
            <div style={{ display: 'flex', gap: 56 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', fontSize: 20, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1 }}>
                  National rank
                </div>
                <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>#{national.national_rank}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', fontSize: 20, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1 }}>
                  National votes
                </div>
                <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{formatVotes(national.national_votes)}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 28, color: '#f87171' }}>Did not run in {latestYear}</div>
          )}
          {topProvince && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', fontSize: 20, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1 }}>
                Top province
              </div>
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, maxWidth: 380 }}>
                {topProvince.adm2_en} ({(topProvince.vote_share * 100).toFixed(0)}%)
              </div>
            </div>
          )}
        </div>

        {/* Trend sparkline across all runs */}
        {trend.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: 'auto', height: 120 }}>
            {trend.map(t => (
              <div key={t.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 46,
                    height: Math.max(10, (t.vote_share / maxShare) * 90),
                    background: yearColor(t.year),
                    borderRadius: 6,
                  }}
                />
                <div style={{ display: 'flex', fontSize: 18, color: '#71717a' }}>{t.year}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    size
  );
}
