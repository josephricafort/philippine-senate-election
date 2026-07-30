'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, ArrowUpDown, Share2 } from 'lucide-react';
import { swingColor, quartileSample, formatSwingParts } from '@/lib/swing';
import { trackEvent } from '@/lib/analytics';

type Row = { adm2_en: string; share_a: number; share_b: number; delta: number };

type Props = {
  rows: Row[];
  senatorId: string;
  senatorName: string;
  yearA: number;
  yearB: number;
  /** Tailwind `top-*` class for the sticky column header when expanded — defaults to flush
   *  against the viewport, but pages with their own sticky header/tab stack (e.g. ExplorerClient)
   *  need to pass an offset so this chart's header docks below theirs instead of underneath it. */
  stickyTopClassName?: string;
};

const SAMPLE_SIZE = 7;

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

// All-province diverging swing bars — the "which provinces moved the most" overview that sits
// above the province picker, so choosing a province to drill into isn't a blind guess.
export default function ProvinceSwingBarChart({ rows, senatorId, senatorName, yearA, yearB, stickyTopClassName = 'top-0' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Sorting only applies once expanded — the collapsed view stays the curated quartile sample
  // below (biggest drop, ~median, biggest gain, etc.) regardless of sort state, so a sort click
  // always acts on the full list rather than re-sampling a handful of rows.
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortKey === 'name' ? a.adm2_en.localeCompare(b.adm2_en) : a.delta - b.delta;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    const nextDir: SortDir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    if (sortKey === key) {
      setSortDir(nextDir);
    } else {
      setSortKey(key);
      // Name defaults A-Z; delta defaults ascending too, which for a signed swing value means
      // biggest drop first — the ordering this list traditionally led with before sort was added.
      setSortDir(nextDir);
    }
    setExpanded(true);
    trackEvent('sort_chart', { chart: 'province_swing', sort_key: key, sort_dir: nextDir });
  }

  if (rows.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-1">Provinces</p>
      <p className="text-muted-foreground text-sm py-2">No province data for {yearA} → {yearB}</p>
    </div>
  );

  const maxAbsDelta = Math.max(...rows.map(r => Math.abs(r.delta)), 0.01);
  const sample = quartileSample(rows, r => r.adm2_en, SAMPLE_SIZE);
  const visible: { row: Row; label: string }[] = expanded
    ? sorted.map(row => ({ row, label: '' }))
    : sample;

  return (
    <div className="rounded-xl border bg-card p-4">
      {/* Sticky to the page viewport (not an inner scroll box) so the column labels stay
          readable during a long expanded list without adding a second, conflicting scroll
          region inside the card. pb-3 + border-b gives the stuck header a visible seam once
          it's pinned, instead of butting flush against whatever's scrolling beneath it. */}
      <div className={expanded ? `sticky ${stickyTopClassName} z-10 bg-card -mx-4 px-4 pt-4 pb-3 -mt-4 border-b border-border` : ''}>
        <div className="flex items-start justify-between mb-3.5 gap-2">
          <p className="text-sm font-semibold">
            Provinces &middot; {senatorName} &middot; {yearA} &rarr; {yearB}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/senator/${senatorId}/share/province?yearA=${yearA}&yearB=${yearB}`}
              title="Share this chart"
              aria-label="Share this chart"
              className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all"
            >
              <Share2 className="w-3 h-3" />
              Share chart
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-[128px_1fr_52px] gap-2.5 mb-2 text-xs text-muted-foreground">
          {/* active only once expanded — the collapsed rows are the curated quartile sample below,
              not actually sorted by sortKey, so neither header should look "active" until sorting
              is the thing actually driving what's visible. */}
          <SortButton label="Province" active={expanded && sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
          <div />
          <div className="flex justify-end">
            <SortButton label="Swing" active={expanded && sortKey === 'delta'} dir={sortDir} onClick={() => toggleSort('delta')} />
          </div>
        </div>

        <div className="grid grid-cols-[128px_1fr_52px] gap-2.5">
          <div />
          <div className="flex justify-between font-mono text-xs text-muted-foreground/70">
            <span>−{(maxAbsDelta * 100).toFixed(0)}pt</span>
            <span>0</span>
            <span>+{(maxAbsDelta * 100).toFixed(0)}pt</span>
          </div>
          <div />
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {visible.map(({ row, label }) => {
          const gain = row.delta >= 0;
          const color = swingColor(row.delta);
          const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 50;
          const { sign, magnitude } = formatSwingParts(row.delta);
          return (
            <div key={row.adm2_en} className="grid grid-cols-[128px_1fr_52px] gap-2.5 items-center">
              <div className="min-w-0">
                <p className="text-sm truncate" title={row.adm2_en}>{row.adm2_en}</p>
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
          onClick={() => setExpanded(e => {
            trackEvent('expand_chart', { chart: 'province_swing', expanded: !e });
            return !e;
          })}
          className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${rows.length} provinces`}
        </button>
      )}
    </div>
  );
}
