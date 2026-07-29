'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProvinceSelect from '@/components/ProvinceSelect';
import ProvinceSwingChart from '@/components/ProvinceSwingChart';
import ProvinceSwingBarChart from '@/components/ProvinceSwingBarChart';
import MunicipalitySwingChart from '@/components/MunicipalitySwingChart';
import { formatSwingPt, type YearPair } from '@/lib/swing';
import type { Senator } from '@/lib/types';

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
  /** Called when the user follows the "See the National Trends instead" link shown for
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

  // Two other top provinces (excluding the selected one) as dim context lines.
  const contextTrends = useMemo(() => {
    if (!province) return [];
    return topProvinceNames
      .filter(p => p !== province)
      .slice(0, 2)
      .map(adm2_en => ({ adm2_en, trend: trendByProvince.get(adm2_en) ?? [] }));
  }, [province, topProvinceNames, trendByProvince]);

  const provinceTrend = province ? trendByProvince.get(province) ?? [] : [];

  // Province/municipality swing compares whichever pair the year-pair selector chose.
  const [yearA, yearB] = yearPair ?? [undefined, undefined];

  const muniRows = province ? muniRowsByProvince[province] ?? [] : [];

  // Swing needs at least two runs to mean anything — keep the section (so its place in the
  // page layout stays predictable) but swap the charts for an explanation instead of just
  // vanishing, which otherwise reads as a bug rather than an expected one-run outcome.
  if (senator.years.length < 2) {
    return (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
          Where support shifted
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Swing values are only available for candidates who ran in 2 or more elections.
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
              See the National Trends instead
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

  // Municipality bar chart: name the biggest mover within the selected province.
  const biggestMuniMove = muniRows.length > 0
    ? [...muniRows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
    : null;

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
        Where support shifted
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {yearA !== undefined && yearB !== undefined
          ? `Percentage-point change in vote share by province, ${yearA} → ${yearB}.`
          : 'Percentage-point change in vote share by province between two consecutive runs.'}
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
        Select a province to see its trend and municipality-level detail.
      </p>
      <div className="mb-5">
        <ProvinceSelect provinces={provinces} value={province} onChange={setProvince} />
      </div>

      {province && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4">
            {provinceIndexSwing !== null && latestProvinceIndex !== undefined && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {latestProvinceIndex >= 1
                  ? `${province} is a stronghold — ${latestProvinceIndex.toFixed(2)}x the national average as of ${provinceTrend[provinceTrend.length - 1]?.year}.`
                  : `${province} underperforms the national average — ${latestProvinceIndex.toFixed(2)}x as of ${provinceTrend[provinceTrend.length - 1]?.year}.`}
                {' '}{provinceIndexSwing >= 0 ? 'Improved' : 'Weakened'} {Math.abs(provinceIndexSwing).toFixed(2)}x since {provinceTrend[0]?.year}.
              </p>
            )}
            <ProvinceSwingChart province={province} trend={provinceTrend} contextTrends={contextTrends} />
          </div>

          {yearA !== undefined ? (
            <div>
              {biggestMuniMove && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-2.5">
                  Biggest mover in {province}: {biggestMuniMove.adm3_en} {formatSwingPt(biggestMuniMove.delta)} from {yearA} to {yearB}.
                </p>
              )}
              <MunicipalitySwingChart rows={muniRows} province={province} yearA={yearA} yearB={yearB} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Needs at least two runs in this province to show municipality-level swing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
