'use client';
import type { Metric } from '@/lib/types';

const OPTIONS: { value: Metric; label: string; shortLabel: string }[] = [
  { value: 'rank',       label: 'Rank',       shortLabel: 'Rank' },
  { value: 'swing',      label: 'Swing',      shortLabel: 'Swing' },
  { value: 'vote_share', label: 'Vote share', shortLabel: 'Share' },
  { value: 'votes',      label: 'Raw votes',  shortLabel: 'Votes' },
];

type Props = {
  value: Metric;
  onChange: (m: Metric) => void;
};

// Styled light/white regardless of the app's theme — this toggle only ever sits inside the
// map's own "View By" strip, which is being treated as part of the map's chrome (matching the
// map's own always-light zoom controls, legend, and context box) rather than the dark app shell.
// Swing stays selectable even for one-time candidates — ChoroplethMap shows a hatched map and
// an explanatory message in that case rather than the tab disappearing.
export default function MetricToggle({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`h-7 px-2 sm:px-3 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <span className="sm:hidden">{opt.shortLabel}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
