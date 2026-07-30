'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import { yearColor } from '@/lib/year-colors';
import { netSwing, swingColor } from '@/lib/swing';
import SwingPill from '@/components/SwingPill';

type DataPoint = { year: number; vote_share: number };

type Props = {
  data: DataPoint[];
};

// Show 2010 as a tick on the axis (no election that year) without breaking the line —
// the line stays continuous across the gap, the tick + dashed marker just call it out.
function axisTicks(data: DataPoint[]): number[] {
  const years = data.map(d => d.year);
  const ticks = [...years];
  if (years.includes(2007) && years.includes(2013) && !years.includes(2010)) {
    ticks.push(2010);
  }
  return ticks.sort((a, b) => a - b);
}

export default function TrendChart({ data }: Props) {
  if (data.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
        No trend data
      </div>
    </div>
  );

  const showGapMarker = data.some(d => d.year === 2007) && data.some(d => d.year === 2013);
  const swing = netSwing(data);
  const lineColor = swingColor(swing);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between mb-3.5">
        <p className="text-sm font-semibold">
          Nationwide vote share from {data[0].year} to {data[data.length - 1].year}
        </p>
        {data.length > 1 && <SwingPill delta={swing} />}
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%" minHeight={128}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <XAxis
              dataKey="year"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={axisTicks(data)}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => v === 0 ? '' : `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
              labelStyle={{ color: '#a1a1aa', fontSize: 12 }}
              formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, 'Vote share']}
            />
            {showGapMarker && (
              <ReferenceLine x={2010} stroke="#3f3f46" strokeDasharray="3 3" label={{ value: 'no election', fill: '#52525b', fontSize: 10, position: 'top' }} />
            )}
            <Line
              type="monotone"
              dataKey="vote_share"
              stroke={lineColor}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload?: DataPoint }) => (
                <Dot key={props.payload?.year} cx={props.cx} cy={props.cy} r={4.5} fill={yearColor(props.payload?.year ?? 0)} />
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
