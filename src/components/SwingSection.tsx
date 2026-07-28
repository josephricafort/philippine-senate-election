'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProvinceSelect from '@/components/ProvinceSelect';
import ProvinceSwingChart from '@/components/ProvinceSwingChart';
import ProvinceSwingBarChart from '@/components/ProvinceSwingBarChart';
import MunicipalitySwingChart from '@/components/MunicipalitySwingChart';
import { provinceList, provinceShareTrend, provinceSwing, municipalitySwing, topProvinces } from '@/lib/data';
import { formatSwingPt, type YearPair } from '@/lib/swing';
import type { Senator, VoteData } from '@/lib/types';

type Props = {
  senator: Senator;
  voteCache: Map<number, VoteData>;
  latestVoteData: VoteData | null;
  /** Which consecutive pair of runs to compare — selected via SwingYearPairSelector in page.tsx. */
  yearPair: YearPair | null;
};

// Reads ?province= from the URL so a specific province's swing view is shareable/linkable
// (e.g. /senator/go_bong?province=Cavite) without minting a static page per province.
export default function SwingSection({ senator, voteCache, latestVoteData, yearPair }: Props) {
  const searchParams = useSearchParams();
  const provinceParam = searchParams.get('province');
  const provinces = latestVoteData ? provinceList(latestVoteData) : [];

  // Default to the ?province= URL param if valid, else the candidate's #1 province in their
  // most recent year — computed once as the initial state so static HTML already shows real
  // data, no effect needed.
  const [province, setProvince] = useState<string | null>(() => {
    if (provinceParam && provinces.includes(provinceParam)) return provinceParam;
    return latestVoteData ? topProvinces(latestVoteData, senator.senator_id, 1)[0]?.adm2_en ?? null : null;
  });

  // Two other top provinces (excluding the selected one) as dim context lines.
  const contextTrends = useMemo(() => {
    if (!latestVoteData || !province) return [];
    return topProvinces(latestVoteData, senator.senator_id, 4)
      .filter(p => p.adm2_en !== province)
      .slice(0, 2)
      .map(p => ({ adm2_en: p.adm2_en, trend: provinceShareTrend(voteCache, senator.senator_id, p.adm2_en) }));
  }, [latestVoteData, province, senator.senator_id, voteCache]);

  const provinceTrend = province ? provinceShareTrend(voteCache, senator.senator_id, province) : [];

  // Province/municipality swing compares whichever pair the year-pair selector chose.
  const [yearA, yearB] = yearPair ?? [undefined, undefined];
  const voteDataA = yearA !== undefined ? voteCache.get(yearA) : undefined;
  const voteDataB = yearB !== undefined ? voteCache.get(yearB) : undefined;

  const muniRows = (province && voteDataA && voteDataB)
    ? municipalitySwing(voteDataA, voteDataB, senator.senator_id, province)
    : [];

  const provinceRows = (voteDataA && voteDataB)
    ? provinceSwing(voteDataA, voteDataB, senator.senator_id)
    : [];

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
