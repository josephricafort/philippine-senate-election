import { useMemo } from 'react';
import type { VoteData, Metric } from '@/lib/types';

// Returns a lookup of adm3_psgc → numeric value for the given metric and senator.
// Used to drive MapLibre paint expressions without mutating the geojson.
export function useMapData(
  voteData: VoteData | null,
  senatorId: string | null,
  metric: Metric
): Record<string, number> {
  return useMemo(() => {
    if (!voteData || !senatorId) return {};
    const result: Record<string, number> = {};
    for (const [psgc, mun] of Object.entries(voteData.municipalities)) {
      const candidate = mun.candidates.find(c => c.senator_id === senatorId);
      if (!candidate) continue;
      result[psgc] =
        metric === 'vote_share' ? candidate.vote_share
        : metric === 'rank'    ? candidate.rank
        :                        candidate.votes;
    }
    return result;
  }, [voteData, senatorId, metric]);
}
