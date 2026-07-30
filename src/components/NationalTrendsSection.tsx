'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProvinceSelect from '@/components/ProvinceSelect';
import ShareBarChart from '@/components/ShareBarChart';

type ShareRow = { adm2_en: string; vote_share: number; trend: { year: number; vote_share: number }[] };
type MuniShareRow = { psgc: string; adm3_en: string; vote_share: number; trend: { year: number; vote_share: number }[] };

type Props = {
  year: number;
  /** Every province the candidate has data for in `year`, for the top-level share table. */
  provinceShares: ShareRow[];
  /** This candidate's top provinces in `year`, most-voted first — picks the default selected
   *  province, same convention SwingSection uses for its own default. */
  topProvinceNames: string[];
  /** Municipality-level share rows for `year`, keyed by province — only the provinces the
   *  candidate actually contested. */
  muniSharesByProvince: Record<string, MuniShareRow[]>;
};

// "Share by province" / "Share by municipality" — the National Trends counterpart of
// SwingSection's own province bar chart + dropdown + municipality breakdown, showing vote share
// itself rather than the change in vote share between two runs.
export default function NationalTrendsSection({ year, provinceShares, topProvinceNames, muniSharesByProvince }: Props) {
  const searchParams = useSearchParams();
  const provinceParam = searchParams.get('province');
  const provinces = useMemo(() => provinceShares.map(p => p.adm2_en).sort(), [provinceShares]);

  const [province, setProvince] = useState<string | null>(() => {
    if (provinceParam && provinces.includes(provinceParam)) return provinceParam;
    return topProvinceNames[0] ?? provinces[0] ?? null;
  });

  const provinceRows = provinceShares.map(p => ({
    key: p.adm2_en,
    name: p.adm2_en,
    vote_share: p.vote_share,
    trend: p.trend,
  }));

  const muniRows = (province ? muniSharesByProvince[province] ?? [] : []).map(m => ({
    key: m.psgc,
    name: m.adm3_en,
    vote_share: m.vote_share,
    trend: m.trend,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Vote share earned in every province in {year}, with the trend across every election
          this candidate has run in.
        </p>
        <ShareBarChart
          title={`Share by province · ${year}`}
          rows={provinceRows}
          nameHeader="Province"
          shareHeader="Share w/in Prov."
          sampleSize={7}
          emptyMessage="No province data"
          year={year}
        />
      </div>

      <div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          Select a province to see its municipality-level breakdown.
        </p>
        <ProvinceSelect provinces={provinces} value={province} onChange={setProvince} />
      </div>

      {province && (
        <ShareBarChart
          title={`Share by municipality — ${province} · ${year}`}
          rows={muniRows}
          nameHeader="Municipality"
          shareHeader="Share w/in Muni."
          sampleSize={5}
          emptyMessage={`No municipality data for ${province}`}
          year={year}
        />
      )}
    </div>
  );
}
