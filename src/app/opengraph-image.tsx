import { ImageResponse } from 'next/og';
import { YEAR_COLORS } from '@/lib/year-colors';

export const alt = 'Philippine Senate Election Explorer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const years = Object.entries(YEAR_COLORS);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, color: '#a1a1aa' }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#0891b2', display: 'flex' }} />
          2007–2025 &middot; Municipality-level results
        </div>

        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, marginTop: 28, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 980 }}>
          Philippine Senate Election Explorer
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: '#a1a1aa', marginTop: 24, maxWidth: 820, lineHeight: 1.4 }}>
          Look up any candidate&rsquo;s vote share, rank, strongholds, and trend across seven elections.
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 'auto' }}>
          {years.map(([year, color]) => (
            <div
              key={year}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 20,
                fontWeight: 600,
                color: '#e4e4e7',
                background: `${color}26`,
                padding: '8px 16px',
                borderRadius: 999,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'flex' }} />
              {year}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
