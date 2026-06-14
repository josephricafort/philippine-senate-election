import type { VoteData, CandidateIndex, Senator } from './types';

export async function loadVotes(year: number): Promise<VoteData> {
  const res = await fetch(`/data/votes_${year}.json`);
  if (!res.ok) throw new Error(`Failed to load votes for ${year}`);
  return res.json();
}

export async function loadCandidateIndex(): Promise<CandidateIndex> {
  const res = await fetch('/data/candidate_index.json');
  if (!res.ok) throw new Error('Failed to load candidate index');
  return res.json();
}

export function buildSenatorList(index: CandidateIndex): Senator[] {
  return index.map(e => ({
    senator_id: e.senator_id,
    senator_name: e.senator_name,
    years: e.years.map(Number),
  }));
}

// Top N municipalities for a senator in a given year, sorted by vote_share desc
export function topMunicipalities(
  voteData: VoteData,
  senatorId: string,
  n = 5
) {
  return Object.entries(voteData.municipalities)
    .flatMap(([psgc, mun]) => {
      const c = mun.candidates.find(c => c.senator_id === senatorId);
      return c ? [{ psgc, adm3_en: mun.adm3_en, adm2_en: mun.adm2_en, ...c }] : [];
    })
    .sort((a, b) => b.vote_share - a.vote_share)
    .slice(0, n);
}

// Vote share per year for a senator (for the trend chart)
export function trendData(
  yearDataMap: Map<number, VoteData>,
  senatorId: string
): { year: number; vote_share: number }[] {
  const result: { year: number; vote_share: number }[] = [];
  for (const [year, data] of yearDataMap) {
    if (!data.national[senatorId]) continue;
    const totalMunVotes = Object.values(data.municipalities).reduce((sum, mun) => {
      const c = mun.candidates.find(c => c.senator_id === senatorId);
      return sum + (c?.votes ?? 0);
    }, 0);
    const totalVotes = Object.values(data.municipalities).reduce((sum, mun) => {
      return sum + mun.candidates.reduce((s, c) => s + c.votes, 0);
    }, 0);
    result.push({ year, vote_share: totalVotes > 0 ? totalMunVotes / totalVotes : 0 });
  }
  return result.sort((a, b) => a.year - b.year);
}
