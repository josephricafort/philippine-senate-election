'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, ArrowLeftRight, Building2, Map as MapIcon } from 'lucide-react';
import ProvinceSelect from '@/components/ProvinceSelect';
import ProvinceSwingChart from '@/components/ProvinceSwingChart';
import ProvinceSwingBarChart from '@/components/ProvinceSwingBarChart';
import MunicipalitySwingChart from '@/components/MunicipalitySwingChart';
import type { YearPair } from '@/lib/swing';
import type { Senator } from '@/lib/types';
import { trackEvent } from '@/lib/analytics';
import { headlineName } from '@/lib/display-name';

type Point = { year: number; vote_share: number; national_share: number };

type Props = {
  senator: Senator;
  /** Every province the senator has ever appeared in, each with its full multi-year trend —
   *  precomputed server-side (page.tsx) so this client component never has to receive the raw,
   *  all-candidates municipality-level voteCache just to derive one senator's numbers. */
  provinceTrends: { adm2_en: string; trend: Point[] }[];
  /** This senator's top provinces in their most recent year, most-voted first — used to pick
   *  the default selected province and the two dimmed context lines. */
  topProvinceNames: string[];
  /** Province-level swing rows for the selected year pair (one row per province). */
  provinceRows: { adm2_en: string; share_a: number; share_b: number; delta: number }[];
  /** Municipality-level swing rows for the selected year pair, keyed by province — only the
   *  provinces the senator actually contested, not every municipality nationwide. */
  muniRowsByProvince: Record<string, { psgc: string; adm3_en: string; share_a: number; share_b: number; delta: number }[]>;
  /** Which consecutive pair of runs to compare — selected via SwingYearPairSelector in page.tsx. */
  yearPair: YearPair | null;
  /** Called when the user follows the "See Vote Share Trends instead" link shown for
   *  single-run candidates — lets the parent flip both the profile tab and the map metric. */
  onSwitchToTrends?: () => void;
};

// Reads ?province= from the URL so a specific province's swing view is shareable/linkable
// (e.g. /senator/go_bong?province=Cavite) without minting a static page per province.
export default function SwingSection({ senator, provinceTrends, topProvinceNames, provinceRows, muniRowsByProvince, yearPair, onSwitchToTrends }: Props) {
  const searchParams = useSearchParams();
  const provinceParam = searchParams.get('province');
  const provinces = useMemo(() => provinceTrends.map(p => p.adm2_en).sort(), [provinceTrends]);
  const trendByProvince = useMemo(() => new Map(provinceTrends.map(p => [p.adm2_en, p.trend])), [provinceTrends]);

  // Default to the ?province= URL param if valid, else the candidate's #1 province in their
  // most recent year — computed once as the initial state so static HTML already shows real
  // data, no effect needed.
  const [province, setProvince] = useState<string | null>(() => {
    if (provinceParam && provinces.includes(provinceParam)) return provinceParam;
    return topProvinceNames[0] ?? null;
  });

  const provinceTrend = province ? trendByProvince.get(province) ?? [] : [];

  function handleProvinceChange(p: string) {
    trackEvent('select_province', { province: p, candidate_id: senator.senator_id, context: 'swing' });
    setProvince(p);
  }

  // Province/municipality swing compares whichever pair the year-pair selector chose.
  const [yearA, yearB] = yearPair ?? [undefined, undefined];

  const muniRows = province ? muniRowsByProvince[province] ?? [] : [];

  // Swing needs at least two runs to mean anything — keep the section (so its place in the
  // page layout stays predictable) but swap the charts for an explanation instead of just
  // vanishing, which otherwise reads as a bug rather than an expected one-run outcome.
  if (senator.years.length < 2) {
    return (
      <div>
        <div className="mb-1 flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-base font-semibold">
            Vote-Share Swing
          </h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Vote-share swing is only available for candidates who ran in 2 or more elections.
          {' '}{senator.senator_name} has only run once ({senator.years[0]}), so there&rsquo;s
          no prior result to compare against.
        </p>
        {onSwitchToTrends && (
          <p className="text-sm mt-1">
            <button
              type="button"
              onClick={onSwitchToTrends}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              See Vote Share Trends instead
            </button>
          </p>
        )}
      </div>
    );
  }

  // Province line chart: state the swing in the currently selected province specifically,
  // since the chart's own "1.0x national avg" framing isn't self-explanatory at a glance.
  const provinceIndexed = provinceTrend
    .map(t => (t.national_share > 0 ? t.vote_share / t.national_share : undefined))
    .filter((v): v is number => v !== undefined);
  const provinceIndexSwing = provinceIndexed.length > 1
    ? provinceIndexed[provinceIndexed.length - 1] - provinceIndexed[0]
    : null;
  const latestProvinceIndex = provinceIndexed[provinceIndexed.length - 1];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-heading text-base font-semibold">
          Vote-Share Swing
        </h3>
      </div>

      <div className="mt-4 mb-1 flex items-center gap-2">
        <MapIcon className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-heading text-sm font-semibold">Vote-Share Swing by Province</h4>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Shows whether {headlineName(senator.senator_name)} gained or lost vote share in each province
        {yearA !== undefined && yearB !== undefined ? ` between ${yearA} and ${yearB}` : ''}.
      </p>

      {yearA !== undefined && (
        <div className="mb-6">
          <ProvinceSwingBarChart
            rows={provinceRows}
            senatorId={senator.senator_id}
            senatorName={senator.senator_name}
            yearA={yearA}
            yearB={yearB}
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
        Select a province to see how {headlineName(senator.senator_name)} performed there over time and how each municipality shifted.
      </p>
      <div className="mb-5">
        <ProvinceSelect provinces={provinces} value={province} onChange={handleProvinceChange} />
      </div>

      {province && (
        <div className="space-y-6">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-heading text-sm font-semibold">Province Performance vs National Average in {province}</h4>
            </div>
            {provinceIndexSwing !== null && latestProvinceIndex !== undefined && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">
                Shows whether {headlineName(senator.senator_name)} performed above or below their national average in {province} across election years. Values above 1 mean stronger-than-average performance; values below 1 mean weaker-than-average performance.
              </p>
            )}
            <div className="rounded-xl border bg-card p-4">
              <ProvinceSwingChart province={province} trend={provinceTrend} />
            </div>
          </div>

          {yearA !== undefined ? (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-heading text-sm font-semibold">Vote-Share Swing by Municipality in {province}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">
                Shows which municipalities in {province} gave {headlineName(senator.senator_name)} a higher or lower vote share
                {yearA !== undefined && yearB !== undefined ? ` between ${yearA} and ${yearB}` : ''}.
              </p>
              <MunicipalitySwingChart rows={muniRows} province={province} yearA={yearA} yearB={yearB} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Needs at least two runs in this province to show municipality-level vote-share swing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
