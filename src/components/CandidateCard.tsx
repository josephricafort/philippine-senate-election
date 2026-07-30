'use client';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RankDisclaimerTooltip } from '@/components/InfoTooltip';
import YearSelector from '@/components/YearSelector';
import ProfileShareMenu from '@/components/ProfileShareMenu';
import { headlineName } from '@/lib/display-name';
import type { ElectionYear, NationalTotals, Senator } from '@/lib/types';

type Props = {
  senator: Senator;
  /** Just this senator's national totals for `year`, not the full VoteData — that dataset
   *  covers every municipality and every candidate who ran, and passing the whole object into
   *  this (client) component would serialize all of it into the page's RSC payload for a
   *  single-object lookup. */
  national: NationalTotals | null;
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

export function CandidateHeader({ senator, national }: { senator: Senator; national: NationalTotals | null }) {
  const years = [...senator.years].sort((a, b) => a - b);
  const shareText = years.length > 1
    ? `${headlineName(senator.senator_name)}: how did your city or town vote since ${years[0]}? See the results here:`
    : `${headlineName(senator.senator_name)}: how did your city or town vote? See the results here:`;

  return (
    <div className="flex items-center gap-3 md:gap-5">
      <div className={`w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm md:text-base shrink-0 select-none ${national ? 'bg-primary text-primary-foreground' : 'bg-destructive/20 text-destructive'}`}>
        {initials(senator.senator_name)}
      </div>
      <h2 className="flex-1 min-w-0 font-bold text-xl md:text-2xl leading-tight truncate">{senator.senator_name}</h2>
      <ProfileShareMenu
        url={`/?candidate=${senator.senator_id}`}
        text={shareText}
        candidateId={senator.senator_id}
        label="Share candidate"
      />
    </div>
  );
}

export default function CandidateCard({ senator, national, year, onSelectYear }: Props) {
  return (
    <div className={national ? '' : 'p-3 md:p-6 rounded-xl border bg-destructive/10 border-destructive/30'}>
      {national ? (
        <div className="flex gap-4 md:gap-8 flex-wrap">
          <div>
            <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide inline-flex items-center gap-1">
              National votes
              <RankDisclaimerTooltip />
            </p>
            <p className="text-sm md:text-base font-semibold mt-0.5 md:mt-1.5">{formatVotes(national.national_votes)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide inline-flex items-center gap-1">
              National rank
              <RankDisclaimerTooltip />
            </p>
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
        <div>
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
  );
}
