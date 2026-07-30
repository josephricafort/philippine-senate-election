'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProvinceSelect from '@/components/ProvinceSelect';
import ShareBarChart from '@/components/ShareBarChart';
import { trackEvent } from '@/lib/analytics';

type ShareRow = { adm2_en: string; vote_share: number; rank: number; trend: { year: number; vote_share: number }[] };
type MuniShareRow = { psgc: string; adm3_en: string; vote_share: number; rank: number; trend: { year: number; vote_share: number }[] };

type Props = {
  year: number;
  candidateId: string;
  /** Every province the candidate has data for in `year`, for the top-level share table. */
  provinceShares: ShareRow[];
  /** This candidate's top provinces in `year`, most-voted first — picks the default selected
   *  province, same convention SwingSection uses for its own default. */
  topProvinceNames: string[];
  /** Municipality-level share rows for `year`, keyed by province — only the provinces the
   *  candidate actually contested. */
  muniSharesByProvince: Record<string, MuniShareRow[]>;
  /** True if the candidate has only ever run once — a trend sparkline has nothing to show in
   *  that case, so ShareBarChart shows each area's rank instead. */
  singleRun: boolean;
  /** Forwarded to ShareBarChart's sticky header offset — see that component for why. */
  chartStickyTopClassName?: string;
};

// "Share by province" / "Share by municipality" — the Trends tab counterpart of SwingSection's
// own province bar chart + dropdown + municipality breakdown, showing vote share itself rather
// than the change in vote share between two runs.
export default function NationalTrendsSection({ year, candidateId, provinceShares, topProvinceNames, muniSharesByProvince, singleRun, chartStickyTopClassName }: Props) {
  const searchParams = useSearchParams();
  const provinceParam = searchParams.get('province');
  const provinces = useMemo(() => provinceShares.map(p => p.adm2_en).sort(), [provinceShares]);

  const [province, setProvince] = useState<string | null>(() => {
    if (provinceParam && provinces.includes(provinceParam)) return provinceParam;
    return topProvinceNames[0] ?? provinces[0] ?? null;
  });

  function handleProvinceChange(p: string) {
    trackEvent('select_province', { province: p, candidate_id: candidateId, context: 'trends' });
    setProvince(p);
  }

  const provinceRows = provinceShares.map(p => ({
    key: p.adm2_en,
    name: p.adm2_en,
    vote_share: p.vote_share,
    rank: p.rank,
    trend: p.trend,
  }));

  const muniRows = (province ? muniSharesByProvince[province] ?? [] : []).map(m => ({
    key: m.psgc,
    name: m.adm3_en,
    vote_share: m.vote_share,
    rank: m.rank,
    trend: m.trend,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold mt-4 mb-1">Vote share by province</h4>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Vote share earned in every province in {year}
        </p>
        {/* mt-2: once the page scrolls, this card sits directly beneath ExplorerClient's own
            sticky "Years Ran" bar with nothing else in between — without its own top margin the
            two look like they're touching, no breathing room at all. */}
        <div className="mt-2">
          <ShareBarChart
            title={`Share by province · ${year}`}
            rows={provinceRows}
            nameHeader="Province"
            shareHeader="Share w/in Prov."
            sampleSize={7}
            emptyMessage="No province data"
            year={year}
            singleRun={singleRun}
            stickyTopClassName={chartStickyTopClassName}
          />
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          Select a province to see vote share by its municipalities
        </p>
        <ProvinceSelect provinces={provinces} value={province} onChange={handleProvinceChange} />
      </div>

      {province && (
        <div>
          <h4 className="text-sm font-semibold mb-2">
            Vote share across election cycles in {province} by municipality
          </h4>
          <ShareBarChart
            title={`Share by municipality — ${province} · ${year}`}
            rows={muniRows}
            nameHeader="Municipality"
            shareHeader="Share w/in Muni."
            sampleSize={5}
            emptyMessage={`No municipality data for ${province}`}
            year={year}
            singleRun={singleRun}
            stickyTopClassName={chartStickyTopClassName}
          />
        </div>
      )}
    </div>
  );
}
