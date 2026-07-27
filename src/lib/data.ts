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

// Top N provinces for a senator in a given year, sorted by vote_share desc.
// Aggregates all municipality votes up to province level, then ranks the
// senator among all candidates using that province's aggregate votes —
// same rank semantics as topMunicipalities, just one level up.
export function topProvinces(
  voteData: VoteData,
  senatorId: string,
  n = 5
) {
  const byProvince = new Map<string, Map<string, number>>();
  for (const mun of Object.values(voteData.municipalities)) {
    let candidateVotes = byProvince.get(mun.adm2_en);
    if (!candidateVotes) {
      candidateVotes = new Map();
      byProvince.set(mun.adm2_en, candidateVotes);
    }
    for (const c of mun.candidates) {
      candidateVotes.set(c.senator_id, (candidateVotes.get(c.senator_id) ?? 0) + c.votes);
    }
  }

  return Array.from(byProvince.entries())
    .flatMap(([adm2_en, candidateVotes]) => {
      const votes = candidateVotes.get(senatorId);
      if (votes === undefined) return [];
      const totalVotes = Array.from(candidateVotes.values()).reduce((s, v) => s + v, 0);
      const rank = Array.from(candidateVotes.values()).filter(v => v > votes).length + 1;
      return [{ adm2_en, votes, vote_share: totalVotes > 0 ? votes / totalVotes : 0, rank }];
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

// Sorted list of every province (adm2_en) present in a year's data — for the swing section's province picker.
export function provinceList(voteData: VoteData): string[] {
  const provinces = new Set(Object.values(voteData.municipalities).map(m => m.adm2_en));
  return Array.from(provinces).sort();
}

// A senator's vote share within one province, per year they ran — the province swing trend line.
// Also carries that year's national vote share, so callers can express province performance
// as an index relative to the candidate's own national average (e.g. "1.4x national") rather
// than raw share — raw province share often tracks the national trend closely enough that the
// two charts read as near-duplicates, which the index framing avoids.
export function provinceShareTrend(
  yearDataMap: Map<number, VoteData>,
  senatorId: string,
  adm2_en: string
): { year: number; vote_share: number; national_share: number }[] {
  const result: { year: number; vote_share: number; national_share: number }[] = [];
  for (const [year, data] of yearDataMap) {
    if (!data.national[senatorId]) continue;
    let candidateVotes = 0;
    let totalVotes = 0;
    let nationalCandidateVotes = 0;
    let nationalTotalVotes = 0;
    for (const mun of Object.values(data.municipalities)) {
      const munTotal = mun.candidates.reduce((s, c) => s + c.votes, 0);
      const munCandidateVotes = mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
      nationalTotalVotes += munTotal;
      nationalCandidateVotes += munCandidateVotes;
      if (mun.adm2_en !== adm2_en) continue;
      totalVotes += munTotal;
      candidateVotes += munCandidateVotes;
    }
    if (totalVotes === 0) continue;
    result.push({
      year,
      vote_share: candidateVotes / totalVotes,
      national_share: nationalTotalVotes > 0 ? nationalCandidateVotes / nationalTotalVotes : 0,
    });
  }
  return result.sort((a, b) => a.year - b.year);
}

// Per-municipality vote-share swing for a senator within one province, between two years —
// sorted by delta ascending (biggest drop first), matching the diverging-bar chart's default sort.
export function municipalitySwing(
  voteDataA: VoteData,
  voteDataB: VoteData,
  senatorId: string,
  adm2_en: string
): { psgc: string; adm3_en: string; share_a: number; share_b: number; delta: number }[] {
  const inProvince = (data: VoteData) =>
    Object.entries(data.municipalities).filter(([, m]) => m.adm2_en === adm2_en);

  const sharesB = new Map<string, number>();
  for (const [psgc, mun] of inProvince(voteDataB)) {
    const total = mun.candidates.reduce((s, c) => s + c.votes, 0);
    const votes = mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
    sharesB.set(psgc, total > 0 ? votes / total : 0);
  }

  return inProvince(voteDataA)
    .flatMap(([psgc, mun]) => {
      const shareB = sharesB.get(psgc);
      if (shareB === undefined) return [];
      const total = mun.candidates.reduce((s, c) => s + c.votes, 0);
      const votes = mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
      const shareA = total > 0 ? votes / total : 0;
      return [{ psgc, adm3_en: mun.adm3_en, share_a: shareA, share_b: shareB, delta: shareB - shareA }];
    })
    .sort((a, b) => a.delta - b.delta);
}
