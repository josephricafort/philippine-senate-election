'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { yearColor } from '@/lib/year-colors';
import { swingColor as getSwingColor } from '@/lib/swing';
import SwingPill from '@/components/SwingPill';

type Point = { year: number; vote_share: number; national_share: number };

type Props = {
  province: string;
  trend: Point[]; // selected province, highlighted
  contextTrends: { adm2_en: string; trend: Point[] }[]; // other top provinces, dimmed
};

// Index = province share ÷ that year's national share. 1.0 = performs exactly at their national
// average here; >1 = overperforms (stronghold), <1 = underperforms — distinct from the raw vote-share
// % used elsewhere, so this chart doesn't just re-plot the national trend chart's own shape.
function toIndex(p: Point): number | undefined {
  return p.national_share > 0 ? p.vote_share / p.national_share : undefined;
}

export default function ProvinceSwingChart({ province, trend, contextTrends }: Props) {
  if (trend.length === 0) return (
    <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
      No data for {province}
    </div>
  );

  const indexed = trend.map(t => ({ year: t.year, index: toIndex(t) })).filter(t => t.index !== undefined) as { year: number; index: number }[];
  const swing = indexed.length > 1 ? indexed[indexed.length - 1].index - indexed[0].index : 0;
  const lineColor = getSwingColor(swing);

  // Merge all series onto one set of year rows so recharts can share an x-axis.
  const years = Array.from(new Set([
    ...trend.map(t => t.year),
    ...contextTrends.flatMap(c => c.trend.map(t => t.year)),
  ])).sort((a, b) => a - b);

  const rows = years.map(year => {
    const row: Record<string, number | undefined> = { year };
    const mainPoint = trend.find(t => t.year === year);
    row.main = mainPoint ? toIndex(mainPoint) : undefined;
    contextTrends.forEach((c, i) => {
      const ctxPoint = c.trend.find(t => t.year === year);
      row[`ctx${i}`] = ctxPoint ? toIndex(ctxPoint) : undefined;
    });
    return row;
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-3.5">
        <p className="text-sm font-semibold">
          <span>{province}</span> vs. national average, by election
        </p>
        {indexed.length > 1 && <SwingPill delta={swing} suffix="x" />}
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%" minHeight={160}>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={years}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${v.toFixed(1)}x`}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
            />
            <ReferenceLine
              y={1}
              stroke="#52525b"
              strokeDasharray="2 2"
              label={{ value: 'national avg', fill: '#71717a', fontSize: 10, position: 'insideTopLeft' }}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#a1a1aa', fontSize: 12 }}
              formatter={(v, name) => [
                v == null ? '—' : `${Number(v).toFixed(2)}x national avg`,
                name === 'main' ? province : contextTrends.find((_, i) => `ctx${i}` === name)?.adm2_en ?? name,
              ]}
            />
            {contextTrends.map((c, i) => (
              <Line
                key={c.adm2_en}
                type="monotone"
                dataKey={`ctx${i}`}
                stroke="#3f3f46"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                connectNulls
              />
            ))}
            <Line
              type="monotone"
              dataKey="main"
              stroke={lineColor}
              strokeWidth={2.5}
              connectNulls
              dot={(props: { cx?: number; cy?: number; payload?: { year: number } }) => (
                <Dot key={props.payload?.year} cx={props.cx} cy={props.cy} r={4.5} fill={yearColor(props.payload?.year ?? 0)} />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {contextTrends.length > 0 && (
        <div className="flex gap-3.5 mt-2.5 pt-3 border-t flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: lineColor }} />
            {province}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full border border-dashed border-muted-foreground shrink-0" />
            {contextTrends.map(c => c.adm2_en).join(', ')} (context)
          </div>
        </div>
      )}
    </div>
  );
}
