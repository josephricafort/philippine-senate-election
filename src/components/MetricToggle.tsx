'use client';
import { Button } from '@/components/ui/button';
import type { Metric } from '@/lib/types';

const OPTIONS: { value: Metric; label: string; shortLabel: string }[] = [
  { value: 'rank',       label: 'Rank',       shortLabel: 'Rank' },
  { value: 'vote_share', label: 'Vote share', shortLabel: 'Share' },
  { value: 'votes',      label: 'Raw votes',  shortLabel: 'Votes' },
];

type Props = {
  value: Metric;
  onChange: (m: Metric) => void;
};

export default function MetricToggle({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {OPTIONS.map(opt => (
        <Button
          key={opt.value}
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 sm:px-3 text-xs"
          onClick={() => onChange(opt.value)}
        >
          <span className="sm:hidden">{opt.shortLabel}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </Button>
      ))}
    </div>
  );
}
