'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Share2 } from 'lucide-react';
import { GAIN, LOSS, quartileSample, formatSwingParts } from '@/lib/swing';

type Row = { adm2_en: string; share_a: number; share_b: number; delta: number };

type Props = {
  rows: Row[];
  senatorId: string;
  senatorName: string;
  yearA: number;
  yearB: number;
};

const SAMPLE_SIZE = 7;

// All-province diverging swing bars — the "which provinces moved the most" overview that sits
// above the province picker, so choosing a province to drill into isn't a blind guess.
export default function ProvinceSwingBarChart({ rows, senatorId, senatorName, yearA, yearB }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-1">Provinces</p>
      <p className="text-muted-foreground text-sm py-2">No province data for {yearA} → {yearB}</p>
    </div>
  );

  const maxAbsDelta = Math.max(...rows.map(r => Math.abs(r.delta)), 0.01);
  const sample = quartileSample(rows, r => r.adm2_en, SAMPLE_SIZE);
  const visible: { row: Row; label: string }[] = expanded
    ? rows.map(row => ({ row, label: '' }))
    : sample;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between mb-3.5 gap-2">
        <p className="text-sm font-semibold">
          Provinces &middot; {senatorName} &middot; {yearA} &rarr; {yearB}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground border-b border-dotted border-muted-foreground/60 whitespace-nowrap">
            biggest drop first
          </span>
          <Link
            href={`/senator/${senatorId}/share/province`}
            title="Share this chart"
            aria-label="Share this chart"
            className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all"
          >
            <Share2 className="w-3 h-3" />
            Share
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[84px_1fr_52px] gap-2.5 mb-2">
        <div />
        <div className="flex justify-between font-mono text-[9px] text-muted-foreground/70">
          <span>−{(maxAbsDelta * 100).toFixed(0)}pt</span>
          <span>0</span>
          <span>+{(maxAbsDelta * 100).toFixed(0)}pt</span>
        </div>
        <div />
      </div>

      <div className="flex flex-col gap-2">
        {visible.map(({ row, label }) => {
          const gain = row.delta >= 0;
          const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 50;
          const { sign, magnitude } = formatSwingParts(row.delta);
          return (
            <div key={row.adm2_en} className="grid grid-cols-[84px_1fr_52px] gap-2.5 items-center">
              <div className="min-w-0">
                <p className="text-xs truncate" title={row.adm2_en}>{row.adm2_en}</p>
                {!expanded && label && (
                  <p className="text-[9px] font-mono text-muted-foreground/70 uppercase tracking-wide truncate">
                    {label}
                  </p>
                )}
              </div>
              <div className="relative h-[18px] bg-border rounded overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                <div
                  className="absolute top-px bottom-px rounded-sm"
                  style={{
                    background: gain ? GAIN : LOSS,
                    width: `${widthPct}%`,
                    left: gain ? '50%' : undefined,
                    right: gain ? undefined : '50%',
                  }}
                />
              </div>
              <p className="font-mono text-xs font-semibold text-right tabular-nums" style={{ color: gain ? GAIN : LOSS }}>
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
          {expanded ? 'Show less' : `Show all ${rows.length} provinces`}
        </button>
      )}
    </div>
  );
}
