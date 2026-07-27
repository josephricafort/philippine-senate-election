'use client';
import { Button } from '@/components/ui/button';
import { ELECTION_YEARS, type ElectionYear } from '@/lib/types';
import { yearColor } from '@/lib/year-colors';

type Props = {
  value: ElectionYear;
  onChange: (y: ElectionYear) => void;
  availableYears?: number[]; // years the selected senator ran in
  filterToAvailable?: boolean; // hide unavailable years entirely instead of graying them out
};

export default function YearSelector({ value, onChange, availableYears, filterToAvailable }: Props) {
  const years = (filterToAvailable && availableYears !== undefined)
    ? ELECTION_YEARS.filter(y => availableYears.includes(y))
    : ELECTION_YEARS;

  return (
    <div className="flex gap-0.5 sm:gap-1">
      {years.map(year => {
        const disabled = !filterToAvailable && availableYears !== undefined && !availableYears.includes(year);
        const active = value === year;
        return (
          <div key={year} className="flex flex-col items-stretch gap-1">
            <Button
              variant={active ? 'default' : 'ghost'}
              size="sm"
              disabled={disabled}
              onClick={() => onChange(year)}
              style={active ? { backgroundColor: yearColor(year), color: '#fff' } : undefined}
              className={`px-2 text-xs sm:px-2.5 sm:text-sm${disabled ? ' opacity-30 cursor-not-allowed' : ''}`}
            >
              {year}
            </Button>
            <span
              className="h-0.5 rounded-full"
              style={{ backgroundColor: yearColor(year), opacity: disabled ? 0.25 : active ? 1 : 0.5 }}
            />
          </div>
        );
      })}
    </div>
  );
}
