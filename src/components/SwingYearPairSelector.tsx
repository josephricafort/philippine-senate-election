'use client';
import { Button } from '@/components/ui/button';
import { yearColor } from '@/lib/year-colors';
import { type YearPair } from '@/lib/swing';

export type { YearPair };

type Props = {
  pairs: YearPair[];
  value: YearPair | null;
  onChange: (pair: YearPair) => void;
};

function pairKey(pair: YearPair): string {
  return `${pair[0]}-${pair[1]}`;
}

export default function SwingYearPairSelector({ pairs, value, onChange }: Props) {
  return (
    <div className="flex gap-0.5 sm:gap-1">
      {pairs.map(pair => {
        const active = value !== null && pairKey(value) === pairKey(pair);
        return (
          <div key={pairKey(pair)} className="flex flex-col items-stretch gap-1">
            <Button
              variant={active ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onChange(pair)}
              className="px-2 text-xs sm:px-2.5 sm:text-sm whitespace-nowrap"
              style={active ? { backgroundColor: yearColor(pair[1]), color: '#fff' } : undefined}
            >
              {pair[0]} → {pair[1]}
            </Button>
            {/* Dual-color underline — one shade per endpoint year, echoing the single-year
                selector's per-year underline so a pair reads as "spanning" those two years. */}
            <span
              className="h-0.5 rounded-full"
              style={{
                background: `linear-gradient(to right, ${yearColor(pair[0])}, ${yearColor(pair[1])})`,
                opacity: active ? 1 : 0.5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
