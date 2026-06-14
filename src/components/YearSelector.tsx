'use client';
import { Button } from '@/components/ui/button';
import { ELECTION_YEARS, type ElectionYear } from '@/lib/types';

type Props = {
  value: ElectionYear;
  onChange: (y: ElectionYear) => void;
  availableYears?: number[]; // years the selected senator ran in
};

export default function YearSelector({ value, onChange, availableYears }: Props) {
  return (
    <div className="flex gap-1">
      {ELECTION_YEARS.map(year => {
        const disabled = availableYears !== undefined && !availableYears.includes(year);
        return (
          <Button
            key={year}
            variant={value === year ? 'default' : 'ghost'}
            size="sm"
            disabled={disabled}
            onClick={() => onChange(year)}
            className={disabled ? 'opacity-30 cursor-not-allowed' : ''}
          >
            {year}
          </Button>
        );
      })}
    </div>
  );
}
