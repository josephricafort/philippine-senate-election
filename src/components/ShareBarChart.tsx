'use client';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { yearColor } from '@/lib/year-colors';

type Row = {
  key: string;
  name: string;
  vote_share: number;
  trend: { year: number; vote_share: number }[];
};

type Props = {
  title: string;
  rows: Row[];
  nameHeader: string;
  shareHeader: string;
  sampleSize: number;
  emptyMessage: string;
  /** Election year this data is for — tints the bar fill with that year's accent color instead
   *  of plain white, so the chart's mood matches the map/pills for the same year. */
  year: number;
};

type SortKey = 'name' | 'share';
type SortDir = 'asc' | 'desc';

// Same "gained since first run / lost since first run" language as swing.ts, applied to a
// share trend instead of a two-year delta — reused here (not imported) since these are plain
// hex, not swingColor's rounds-to-zero-aware version, and a 2+ point sparkline has no
// meaningful "noise" threshold to guard against the way a single delta does.
const GAIN = '#4ade80';
const LOSS = '#f87171';

// Catmull-Rom-to-Bezier conversion so the sparkline curves smoothly through each point instead
// of meeting at rigid angles — same soft-line look as the main national vote trend chart
// (Recharts' type="monotone"), just hand-rolled since this is a plain inline SVG, not a chart.
function smoothPath(points: number[][]): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)} L${points[1][0].toFixed(1)},${points[1][1].toFixed(1)}`;
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 8;
    const c1y = p1[1] + (p2[1] - p0[1]) / 8;
    const c2x = p2[0] - (p3[0] - p1[0]) / 8;
    const c2y = p2[1] - (p3[1] - p1[1]) / 8;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function Sparkline({ trend }: { trend: { year: number; vote_share: number }[] }) {
  if (trend.length < 2) return <span className="text-xs text-muted-foreground">&mdash;</span>;

  const w = 36;
  const h = 14;
  // Extra headroom beyond the stroke/dot's own half-width — a Catmull-Rom curve can overshoot
  // past its endpoint values on its way through a bend, so padding just for strokeWidth/2 still
  // clips that overshoot at the top/bottom edge of the viewBox.
  const pad = 4;
  const values = trend.map(t => t.vote_share);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => [i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const path = smoothPath(points);
  const [lastX, lastY] = points[points.length - 1];
  const color = values[values.length - 1] >= values[0] ? GAIN : LOSS;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" overflow="visible">
      <path d={path} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={1.8} fill={color} />
    </svg>
  );
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
    >
      {label}
      <Icon className="w-3 h-3" />
    </button>
  );
}

// Vote-share-by-area table: an inline bar (like ProvinceSwingBarChart's diverging bar, but a
// single left-anchored fill since share has no "gain/loss" direction) plus a mini sparkline of
// the area's share across every year the candidate ran, in place of a rank badge. Sortable by
// name or share; trend is display-only (sorting by trend shape isn't a meaningful operation).
export default function ShareBarChart({ title, rows, nameHeader, shareHeader, sampleSize, emptyMessage, year }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('share');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortKey === 'name' ? a.name.localeCompare(b.name) : a.vote_share - b.vote_share;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-1">{title}</p>
      <p className="text-muted-foreground text-sm py-2">{emptyMessage}</p>
    </div>
  );

  const maxShare = Math.max(...rows.map(r => r.vote_share), 0.0001);
  const visible = expanded ? sorted : sorted.slice(0, sampleSize);
  const barColor = yearColor(year);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-3.5">{title}</p>

      <div className="grid grid-cols-[128px_1fr_44px] gap-2.5 mb-2 text-[11px] text-muted-foreground">
        <SortButton label={nameHeader} active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
        <div className="flex justify-end">
          <SortButton label={shareHeader} active={sortKey === 'share'} dir={sortDir} onClick={() => toggleSort('share')} />
        </div>
        <span className="text-right">Trend</span>
      </div>

      <div className="flex flex-col gap-2">
        {visible.map(row => {
          const widthPct = (row.vote_share / maxShare) * 100;
          return (
            <div key={row.key} className="grid grid-cols-[128px_1fr_44px] gap-2.5 items-center">
              <div className="min-w-0">
                <p className="text-xs truncate" title={row.name}>{row.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-[18px] bg-border rounded overflow-hidden flex-1">
                  <div
                    className="absolute top-px bottom-px left-px rounded-sm"
                    style={{ width: `${widthPct}%`, background: barColor }}
                  />
                </div>
                <p className="font-mono text-xs font-semibold text-right tabular-nums w-11 shrink-0">
                  {(row.vote_share * 100).toFixed(1)}%
                </p>
              </div>
              <div className="flex justify-end">
                <Sparkline trend={row.trend} />
              </div>
            </div>
          );
        })}
      </div>

      {rows.length > sampleSize && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
