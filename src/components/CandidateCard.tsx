'use client';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RankDisclaimerTooltip } from '@/components/InfoTooltip';
import YearSelector from '@/components/YearSelector';
import ProfileShareMenu from '@/components/ProfileShareMenu';
import { headlineName } from '@/lib/display-name';
import CandidateAvatar from '@/components/CandidateAvatar';
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

function formatVotes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function splitStoredName(storedName: string) {
  const commaIndex = storedName.indexOf(',');
  if (commaIndex === -1) {
    return { line1: storedName, line2: '' };
  }

  return {
    line1: storedName.slice(0, commaIndex + 1).trim(),
    line2: storedName.slice(commaIndex + 1).trim(),
  };
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
  const tabletName = splitStoredName(senator.senator_name);

  return (
    <div className="flex items-center gap-3 md:gap-5">
      <CandidateAvatar
        senatorId={senator.senator_id}
        senatorName={senator.senator_name}
        active={!!national}
        className="w-14 h-14 md:w-16 md:h-16 text-base md:text-lg"
      />
      <h2 className="font-heading min-w-0 flex-1 font-bold text-xl leading-tight md:text-2xl flex flex-col">
        <span className="truncate">{tabletName.line1}</span>
        {tabletName.line2 && <span className="truncate">{tabletName.line2}</span>}
      </h2>
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
                <span className="label-eyebrow text-muted-foreground inline-flex items-center gap-1">
                  National votes
                  <RankDisclaimerTooltip />
                </span>
              </th>
              <th scope="col" className="font-normal pr-6 md:pr-10 pb-0.5 md:pb-1.5">
                <span className="label-eyebrow text-muted-foreground inline-flex items-center gap-1">
                  National rank
                  <RankDisclaimerTooltip />
                </span>
              </th>
              <th scope="col" className="font-normal pb-0.5 md:pb-1.5">
                <span className="label-eyebrow text-muted-foreground">
                  Year
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-6 md:pr-10 text-sm md:text-base xl:text-lg 2xl:text-xl font-medium">{formatVotes(national.national_votes)}</td>
              <td className="pr-6 md:pr-10">
                <Badge variant="secondary" className="text-xs md:text-sm xl:text-base 2xl:text-lg font-medium px-1.5 md:px-2 xl:px-2.5 py-0 md:py-0.5 xl:py-1">
                  #{national.national_rank}
                </Badge>
              </td>
              <td className="text-sm md:text-base xl:text-lg 2xl:text-xl font-medium">{year}</td>
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
            <div className="mt-2 md:mt-3">
              <p className="text-xs text-muted-foreground mb-1.5">Go to year ran</p>
              <div className="overflow-x-auto">
                <YearSelector
                  value={year}
                  onChange={onSelectYear}
                  availableYears={senator.years}
                  filterToAvailable
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
