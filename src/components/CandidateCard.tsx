'use client';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import YearSelector from '@/components/YearSelector';
import type { ElectionYear, Senator, VoteData } from '@/lib/types';

type Props = {
  senator: Senator;
  voteData: VoteData | null;
  year: ElectionYear;
  onSelectYear?: (year: ElectionYear) => void;
};

function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/[\s,]+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function formatVotes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function CandidateCard({ senator, voteData, year, onSelectYear }: Props) {
  const national = voteData?.national[senator.senator_id];

  return (
    <div className={`flex items-start gap-3 md:gap-5 p-3 md:p-6 rounded-xl border ${national ? 'bg-card' : 'bg-destructive/10 border-destructive/30'}`}>
      <div className={`w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm md:text-base shrink-0 select-none ${national ? 'bg-primary text-primary-foreground' : 'bg-destructive/20 text-destructive'}`}>
        {initials(senator.senator_name)}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-base md:text-lg leading-tight truncate">{senator.senator_name}</h2>

        {national ? (
          <div className="flex gap-4 md:gap-8 mt-2 md:mt-6 flex-wrap">
            <div>
              <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide">National votes</p>
              <p className="text-sm md:text-base font-semibold mt-0.5 md:mt-1.5">{formatVotes(national.national_votes)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide">National rank</p>
              <Badge variant="secondary" className="mt-0.5 md:mt-1.5 text-xs md:text-sm px-1.5 md:px-2 py-0 md:py-0.5">
                #{national.national_rank}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide">Year</p>
              <p className="text-sm md:text-base font-semibold mt-0.5 md:mt-1.5">{year}</p>
            </div>
          </div>
        ) : (
          <div className="mt-1 md:mt-2">
            <p className="text-destructive text-xs md:text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Did not run in {year}
            </p>
            {onSelectYear && (
              <div className="mt-2 md:mt-3 overflow-x-auto">
                <YearSelector
                  value={year}
                  onChange={onSelectYear}
                  availableYears={senator.years}
                  filterToAvailable
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
