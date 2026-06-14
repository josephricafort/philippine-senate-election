'use client';
import { Button } from '@/components/ui/button';
import type { Metric } from '@/lib/types';

const OPTIONS: { value: Metric; label: string }[] = [
  { value: 'rank',       label: 'Rank' },
  { value: 'vote_share', label: 'Vote share' },
  { value: 'votes',      label: 'Raw votes' },
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
          className="h-7 px-3 text-xs"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
