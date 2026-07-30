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

export function CandidateHeader({
  senator,
  national,
  swingHeadline,
}: {
  senator: Senator;
  national: NationalTotals | null;
  /** Same claim shown on the municipality swing-map share card (e.g. "X gained support from
   *  1146 out of 1583 (72%) municipalities/cities...") — reused here so even the plain
   *  candidate-profile share text leads with a concrete, checkable number instead of a vague
   *  "performed at the polls." Only available once the candidate's full CandidateData is loaded
   *  and a swing year pair is resolved; falls back to the generic phrasing until then, or for
   *  single-run candidates who have no swing pair at all. */
  swingHeadline?: string | null;
}) {
  const years = [...senator.years].sort((a, b) => a - b);
  const shareText = swingHeadline
    ? `${swingHeadline} See the full breakdown here:`
    : years.length > 1
    ? `See how ${headlineName(senator.senator_name)} performed at the polls in your city or town since ${years[0]}:`
    : `See how ${headlineName(senator.senator_name)} performed at the polls in your city or town:`;
  // view=map tells src/app/page.tsx's generateMetadata to render the municipality swing-map
  // og:image (the graphic from /senator/[slug]/share/map) for this link instead of the generic
  // site card — Facebook/LinkedIn re-scrape the shared URL itself for a preview image, they
  // don't accept one supplied client-side, so the URL has to carry this. Only takes effect for
  // candidates with 2+ runs (resolveShareYearPair needs a pair); for a first-time candidate,
  // generateMetadata quietly falls back to the generic card, same as omitting it entirely.
  const shareUrl = `/?candidate=${senator.senator_id}${years.length > 1 ? '&view=map' : ''}`;

  return (
    <div className="flex items-center gap-3 md:gap-5">
      <div className={`w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm md:text-base shrink-0 select-none ${national ? 'bg-primary text-primary-foreground' : 'bg-destructive/20 text-destructive'}`}>
        {initials(senator.senator_name)}
      </div>
      <h2 className="flex-1 min-w-0 font-bold text-xl md:text-2xl leading-tight truncate">{senator.senator_name}</h2>
      <ProfileShareMenu
        url={shareUrl}
        text={shareText}
        candidateId={senator.senator_id}
      />
    </div>
  );
}

export default function CandidateCard({ senator, national, year, onSelectYear }: Props) {
  return (
    <div className={national ? '' : 'p-3 md:p-6 rounded-xl border bg-destructive/10 border-destructive/30'}>
      {national ? (
        <table className="text-left border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="font-normal pr-6 md:pr-10 pb-0.5 md:pb-1.5">
                <span className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide inline-flex items-center gap-1">
                  National votes
                  <RankDisclaimerTooltip />
                </span>
              </th>
              <th scope="col" className="font-normal pr-6 md:pr-10 pb-0.5 md:pb-1.5">
                <span className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide inline-flex items-center gap-1">
                  National rank
                  <RankDisclaimerTooltip />
                </span>
              </th>
              <th scope="col" className="font-normal pb-0.5 md:pb-1.5">
                <span className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wide">
                  Year
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-6 md:pr-10 text-sm md:text-base font-semibold">{formatVotes(national.national_votes)}</td>
              <td className="pr-6 md:pr-10">
                <Badge variant="secondary" className="text-xs md:text-sm px-1.5 md:px-2 py-0 md:py-0.5">
                  #{national.national_rank}
                </Badge>
              </td>
              <td className="text-sm md:text-base font-semibold">{year}</td>
            </tr>
          </tbody>
        </table>
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
