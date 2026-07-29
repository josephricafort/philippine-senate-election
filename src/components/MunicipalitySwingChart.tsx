'use client';
import { useState } from 'react';
import { swingColor, quartileSample, formatSwingParts } from '@/lib/swing';

type Row = { psgc: string; adm3_en: string; share_a: number; share_b: number; delta: number };

type Props = {
  rows: Row[];
  province: string;
  yearA: number;
  yearB: number;
};

const SAMPLE_SIZE = 5;

export default function MunicipalitySwingChart({ rows, province, yearA, yearB }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-1">Municipalities in {province}</p>
      <p className="text-muted-foreground text-sm py-2">No municipality data for {yearA} → {yearB}</p>
    </div>
  );

  const maxAbsDelta = Math.max(...rows.map(r => Math.abs(r.delta)), 0.01);
  const sample = quartileSample(rows, r => r.psgc, SAMPLE_SIZE);
  const visible: { row: Row; label: string }[] = expanded
    ? rows.map(row => ({ row, label: '' }))
    : sample;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between mb-3.5">
        <p className="text-sm font-semibold">
          Municipalities in {province} &middot; {yearA} &rarr; {yearB}
        </p>
        <span className="text-[11px] font-mono text-muted-foreground border-b border-dotted border-muted-foreground/60 shrink-0 ml-2 whitespace-nowrap">
          biggest drop first
        </span>
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
          const color = swingColor(row.delta);
          const widthPct = (Math.abs(row.delta) / maxAbsDelta) * 50;
          const { sign, magnitude } = formatSwingParts(row.delta);
          return (
            <div key={row.psgc} className="grid grid-cols-[84px_1fr_52px] gap-2.5 items-center">
              <div className="min-w-0">
                <p className="text-xs truncate" title={row.adm3_en}>{row.adm3_en}</p>
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
