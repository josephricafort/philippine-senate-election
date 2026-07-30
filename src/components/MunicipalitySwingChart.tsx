'use client';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { swingColor, quartileSample, formatSwingParts } from '@/lib/swing';

type Row = { psgc: string; adm3_en: string; share_a: number; share_b: number; delta: number };

type Props = {
  rows: Row[];
  province: string;
  yearA: number;
  yearB: number;
};

const SAMPLE_SIZE = 5;

type SortKey = 'name' | 'delta';
type SortDir = 'asc' | 'desc';

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      <Icon className="w-3 h-3" />
    </button>
  );
}

export default function MunicipalitySwingChart({ rows, province, yearA, yearB }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Sorting only applies once expanded — the collapsed view stays the curated quartile sample
  // below (biggest drop, ~median, biggest gain, etc.) regardless of sort state, so a sort click
  // always acts on the full list rather than re-sampling a handful of rows.
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortKey === 'name' ? a.adm3_en.localeCompare(b.adm3_en) : a.delta - b.delta;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Name defaults A-Z; delta defaults ascending too, which for a signed swing value means
      // biggest drop first — the ordering this list traditionally led with before sort was added.
      setSortDir('asc');
    }
    setExpanded(true);
  }

  if (rows.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-1">Municipalities in {province}</p>
      <p className="text-muted-foreground text-sm py-2">No municipality data for {yearA} → {yearB}</p>
    </div>
  );

  const maxAbsDelta = Math.max(...rows.map(r => Math.abs(r.delta)), 0.01);
  const sample = quartileSample(rows, r => r.psgc, SAMPLE_SIZE);
  const visible: { row: Row; label: string }[] = expanded
    ? sorted.map(row => ({ row, label: '' }))
    : sample;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between mb-3.5">
        <p className="text-sm font-semibold">
          Municipalities in {province} &middot; {yearA} &rarr; {yearB}
        </p>
      </div>

      <div className="grid grid-cols-[128px_1fr_52px] gap-2.5 mb-2 text-xs text-muted-foreground">
        {/* active only once expanded — the collapsed rows are the curated quartile sample below,
            not actually sorted by sortKey, so neither header should look "active" until sorting
            is the thing actually driving what's visible. */}
        <SortButton label="Municipality" active={expanded && sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
        <div />
        <div className="flex justify-end">
          <SortButton label="Swing" active={expanded && sortKey === 'delta'} dir={sortDir} onClick={() => toggleSort('delta')} />
        </div>
      </div>

      <div className="grid grid-cols-[128px_1fr_52px] gap-2.5 mb-2">
        <div />
        <div className="flex justify-between font-mono text-xs text-muted-foreground/70">
          <span>−{(maxAbsDelta * 100).toFixed(0)}pt</span>
          <span>0</span>
          <span>+{(maxAbsDelta * 100).toFixed(0)}pt</span>
        </div>
        <div />
      </div>

      <div className="flex flex-col gap-2">
        {visible.map(({ row, label }) => {
          const gain = row.delta >= 0;
          const color = swingColor(row.delta);
          const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 50;
          const { sign, magnitude } = formatSwingParts(row.delta);
          return (
            <div key={row.psgc} className="grid grid-cols-[128px_1fr_52px] gap-2.5 items-center">
              <div className="min-w-0">
                <p className="text-xs truncate" title={row.adm3_en}>{row.adm3_en}</p>
                {!expanded && label && (
                  <p className="text-xs text-muted-foreground/70 uppercase tracking-wide truncate">
                    {label}
                  </p>
                )}
              </div>
              <div className="relative h-[18px] bg-border rounded-[3px] overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                <div
                  className="absolute top-px bottom-px rounded-[3px]"
                  style={{
                    background: color,
                    width: `${widthPct}%`,
                    left: gain ? '50%' : undefined,
                    right: gain ? undefined : '50%',
                  }}
                />
              </div>
              <p className="font-mono text-xs font-semibold text-right tabular-nums" style={{ color }}>
                {sign}{magnitude}
              </p>
            </div>
          );
        })}
      </div>

      {rows.length > SAMPLE_SIZE && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${rows.length} municipalities`}
        </button>
      )}
    </div>
  );
}
