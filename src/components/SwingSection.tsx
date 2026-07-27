'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProvinceSelect from '@/components/ProvinceSelect';
import ProvinceSwingChart from '@/components/ProvinceSwingChart';
import MunicipalitySwingChart from '@/components/MunicipalitySwingChart';
import { provinceList, provinceShareTrend, municipalitySwing, topProvinces } from '@/lib/data';
import type { Senator, VoteData } from '@/lib/types';

type Props = {
  senator: Senator;
  voteCache: Map<number, VoteData>;
  latestVoteData: VoteData | null;
};

// Reads ?province= from the URL so a specific province's swing view is shareable/linkable
// (e.g. /senator/go_bong?province=Cavite) without minting a static page per province.
export default function SwingSection({ senator, voteCache, latestVoteData }: Props) {
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

  // Municipality swing uses the candidate's two most recent runs.
  const runYears = [...senator.years].sort((a, b) => a - b);
  const yearB = runYears[runYears.length - 1];
  const yearA = runYears.length > 1 ? runYears[runYears.length - 2] : undefined;
  const voteDataA = yearA ? voteCache.get(yearA) : undefined;
  const voteDataB = voteCache.get(yearB);

  const muniRows = (province && voteDataA && voteDataB)
    ? municipalitySwing(voteDataA, voteDataB, senator.senator_id, province)
    : [];

  if (senator.years.length < 2) return null; // swing needs at least two runs to mean anything

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
        Where support shifted
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        How {senator.senator_name}&rsquo;s support has shifted across their {senator.years.length} runs
        ({senator.years.join(', ')}) — pick a province to see the trend and drill into its towns.
      </p>

      <div className="mb-5">
        <ProvinceSelect provinces={provinces} value={province} onChange={setProvince} />
      </div>

      {province && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4">
            <ProvinceSwingChart province={province} trend={provinceTrend} contextTrends={contextTrends} />
          </div>

          {yearA !== undefined ? (
            <MunicipalitySwingChart rows={muniRows} province={province} yearA={yearA} yearB={yearB} />
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
