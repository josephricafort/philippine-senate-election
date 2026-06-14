'use client';
import { Badge } from '@/components/ui/badge';
import type { Senator, VoteData } from '@/lib/types';

type Props = {
  senator: Senator;
  voteData: VoteData | null;
  year: number;
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

export default function CandidateCard({ senator, voteData, year }: Props) {
  const national = voteData?.national[senator.senator_id];

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-card border">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shrink-0 select-none">
        {initials(senator.senator_name)}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-lg leading-tight truncate">{senator.senator_name}</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ran: {senator.years.join(', ')}
        </p>

        {national ? (
          <div className="flex gap-5 mt-3 flex-wrap">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">National votes</p>
              <p className="text-base font-semibold mt-0.5">{formatVotes(national.national_votes)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">National rank</p>
              <Badge variant="secondary" className="mt-1 text-sm px-2 py-0.5">
                #{national.national_rank}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Year</p>
              <p className="text-base font-semibold mt-0.5">{year}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm mt-2">Did not run in {year}</p>
        )}
      </div>
    </div>
  );
}
