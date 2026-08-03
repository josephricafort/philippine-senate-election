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
};

// Index = province share ÷ that year's national share. 1.0 = performs exactly at their national
// average here; >1 = overperforms (stronghold), <1 = underperforms — distinct from the raw vote-share
// % used elsewhere, so this chart doesn't just re-plot the national trend chart's own shape.
function toIndex(p: Point): number | undefined {
  return p.national_share > 0 ? p.vote_share / p.national_share : undefined;
}

export default function ProvinceSwingChart({ province, trend }: Props) {
  if (trend.length === 0) return (
    <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
      No data for {province}
    </div>
  );

  const indexed = trend.map(t => ({ year: t.year, index: toIndex(t) })).filter(t => t.index !== undefined) as { year: number; index: number }[];
  const swing = indexed.length > 1 ? indexed[indexed.length - 1].index - indexed[0].index : 0;
  // Index-unit delta (province-vs-national multiplier), not a percentage-point share —
  // scale=1 so "rounds to zero" matches SwingPill's own 1-decimal "x" display below.
  const lineColor = getSwingColor(swing, 1);
  // Always keep the 1.0x national-average baseline inside the plotted range, even when every
  // observed point sits below it; otherwise Recharts clips the ReferenceLine entirely.
  const yMax = Math.max(1.1, ...indexed.map(point => point.index)) * 1.04;

  const rows = trend.map(t => ({ year: t.year, main: toIndex(t) }));

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
              ticks={trend.map(t => t.year)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${v.toFixed(1)}x`}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
            />
            <ReferenceLine
              y={1}
              stroke="var(--border)"
              strokeDasharray="2 2"
              label={{ value: 'national avg', fill: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'var(--font-sans)', position: 'insideTopLeft' }}
            />
            <Tooltip
              contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--muted-foreground)', fontSize: 12, fontFamily: 'var(--font-sans)' }}
              itemStyle={{ fontFamily: 'var(--font-mono)' }}
              formatter={v => [
                v == null ? '—' : `${Number(v).toFixed(2)}x national avg`,
                province,
              ]}
            />
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
    </div>
  );
}
