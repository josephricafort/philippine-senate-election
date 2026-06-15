'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';

type DataPoint = { year: number; vote_share: number };

type Props = {
  data: DataPoint[];
};

// Insert a null gap at the missing election year 2010 so the line breaks visually
function withGap(data: DataPoint[]): { year: number; vote_share: number | null }[] {
  const result: { year: number; vote_share: number | null }[] = [];
  for (const d of data) {
    const prev = result[result.length - 1];
    if (prev && prev.year === 2007 && d.year === 2013) {
      result.push({ year: 2010, vote_share: null });
    }
    result.push(d);
  }
  return result;
}

export default function TrendChart({ data }: Props) {
  if (data.length === 0) return (
    <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">
      No trend data
    </div>
  );

  const chartData = withGap(data);

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%" minHeight={128}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <XAxis
            dataKey="year"
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
          <ReferenceLine x={2010} stroke="#3f3f46" strokeDasharray="3 3" label={{ value: 'no election', fill: '#52525b', fontSize: 10, position: 'top' }} />
          <Line
            type="monotone"
            dataKey="vote_share"
            stroke="#6366f1"
            strokeWidth={2}
            dot={<Dot r={3} fill="#6366f1" />}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
