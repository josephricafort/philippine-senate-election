import type {
  VoteData, CandidateIndex, Senator, CandidateData, NationalYearData, MunicipalityNames,
} from './types';
import { quartileSample } from './swing';
import { headlineName } from './display-name';
import { trackEvent } from './analytics';

export async function loadVotes(year: number): Promise<VoteData> {
  try {
    const res = await fetch(`/data/votes_${year}.json`);
    if (!res.ok) {
      trackEvent('data_fetch_error', { resource: `votes_${year}`, error_type: `http_${res.status}` });
      throw new Error(`Failed to load votes for ${year}`);
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('Failed to load votes'))) {
      trackEvent('data_fetch_error', { resource: `votes_${year}`, error_type: 'network_error' });
    }
    throw err;
  }
}

export async function loadCandidateIndex(): Promise<CandidateIndex> {
  try {
    const res = await fetch('/data/candidate_index.json');
    if (!res.ok) {
      trackEvent('data_fetch_error', { resource: 'candidate_index', error_type: `http_${res.status}` });
      throw new Error('Failed to load candidate index');
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error && err.message === 'Failed to load candidate index')) {
      trackEvent('data_fetch_error', { resource: 'candidate_index', error_type: 'network_error' });
    }
    throw err;
  }
}

export function buildSenatorList(index: CandidateIndex): Senator[] {
  return index.map(e => ({
    senator_id: e.senator_id,
    senator_name: e.senator_name,
    years: e.years.map(Number),
  }));
}

// ── New per-candidate data loaders ───────────────────────────────────────────────────────────
// Replace loadVotes(year) — instead of fetching one year's data for every candidate, these fetch
// one candidate's data across every year they ran, or one year's nationwide totals for every
// candidate (for the leaderboard, which never needs municipality-level data).

export async function loadCandidateData(senatorId: string): Promise<CandidateData> {
  try {
    const res = await fetch(`/data/candidates/${senatorId}.json`);
    if (!res.ok) {
      trackEvent('data_fetch_error', { resource: `candidate_${senatorId}`, error_type: `http_${res.status}` });
      throw new Error(`Failed to load candidate data for ${senatorId}`);
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('Failed to load candidate data'))) {
      trackEvent('data_fetch_error', { resource: `candidate_${senatorId}`, error_type: 'network_error' });
    }
    throw err;
  }
}

export async function loadNationalYear(year: number): Promise<NationalYearData> {
  try {
    const res = await fetch(`/data/national_${year}.json`);
    if (!res.ok) {
      trackEvent('data_fetch_error', { resource: `national_${year}`, error_type: `http_${res.status}` });
      throw new Error(`Failed to load national data for ${year}`);
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('Failed to load national data'))) {
      trackEvent('data_fetch_error', { resource: `national_${year}`, error_type: 'network_error' });
    }
    throw err;
  }
}

export async function loadMunicipalityNames(): Promise<MunicipalityNames> {
  try {
    const res = await fetch('/data/municipality_names.json');
    if (!res.ok) {
      trackEvent('data_fetch_error', { resource: 'municipality_names', error_type: `http_${res.status}` });
      throw new Error('Failed to load municipality names');
    }
    return await res.json();
  } catch (err) {
    if (!(err instanceof Error && err.message === 'Failed to load municipality names')) {
      trackEvent('data_fetch_error', { resource: 'municipality_names', error_type: 'network_error' });
    }
    throw err;
  }
}

// Sums every candidate's national_votes for a year — the "total votes cast nationally" figure
// national_{year}.json doesn't state directly but is needed as the denominator for national
// vote-share calculations (trendData, provinceShareTrend's national_share).
export function nationalTotalVotes(nationalData: NationalYearData): number {
  return Object.values(nationalData).reduce((sum, e) => sum + e.national_votes, 0);
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

// Per-province vote-share swing for a senator across ALL provinces, between two years —
// same shape as municipalitySwing, one level up (province instead of town), sorted by delta
// ascending (biggest drop first).
export function provinceSwing(
  voteDataA: VoteData,
  voteDataB: VoteData,
  senatorId: string
): { adm2_en: string; share_a: number; share_b: number; delta: number }[] {
  const provinceShares = (data: VoteData) => {
    const byProvince = new Map<string, { candidateVotes: number; totalVotes: number }>();
    for (const mun of Object.values(data.municipalities)) {
      let agg = byProvince.get(mun.adm2_en);
      if (!agg) {
        agg = { candidateVotes: 0, totalVotes: 0 };
        byProvince.set(mun.adm2_en, agg);
      }
      agg.totalVotes += mun.candidates.reduce((s, c) => s + c.votes, 0);
      agg.candidateVotes += mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
    }
    const shares = new Map<string, number>();
    for (const [adm2_en, agg] of byProvince) {
      shares.set(adm2_en, agg.totalVotes > 0 ? agg.candidateVotes / agg.totalVotes : 0);
    }
    return shares;
  };

  const sharesA = provinceShares(voteDataA);
  const sharesB = provinceShares(voteDataB);

  return Array.from(sharesA.entries())
    .flatMap(([adm2_en, shareA]) => {
      const shareB = sharesB.get(adm2_en);
      if (shareB === undefined) return [];
      // Round to 0.01pt so near-zero float noise collapses to an exact 0 (see nationwideMunicipalitySwing).
      const delta = Math.round((shareB - shareA) * 10000) / 10000;
      return [{ adm2_en, share_a: shareA, share_b: shareB, delta }];
    })
    .sort((a, b) => a.delta - b.delta);
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
      // Round to 0.01pt so near-zero float noise collapses to an exact 0 (see nationwideMunicipalitySwing).
      const delta = Math.round((shareB - shareA) * 10000) / 10000;
      return [{ psgc, adm3_en: mun.adm3_en, share_a: shareA, share_b: shareB, delta }];
    })
    .sort((a, b) => a.delta - b.delta);
}

// Vote-share swing for a senator across EVERY municipality nationwide, between two years —
// the map-wide counterpart to municipalitySwing (which is scoped to one province). Powers the
// choropleth's "Swing" metric, keyed by psgc for direct lookup per map feature.
export function nationwideMunicipalitySwing(
  voteDataA: VoteData,
  voteDataB: VoteData,
  senatorId: string
): Map<string, { share_a: number; share_b: number; delta: number }> {
  const sharesB = new Map<string, number>();
  for (const [psgc, mun] of Object.entries(voteDataB.municipalities)) {
    const total = mun.candidates.reduce((s, c) => s + c.votes, 0);
    const votes = mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
    sharesB.set(psgc, total > 0 ? votes / total : 0);
  }

  const result = new Map<string, { share_a: number; share_b: number; delta: number }>();
  for (const [psgc, mun] of Object.entries(voteDataA.municipalities)) {
    const shareB = sharesB.get(psgc);
    if (shareB === undefined) continue;
    const total = mun.candidates.reduce((s, c) => s + c.votes, 0);
    const votes = mun.candidates.find(c => c.senator_id === senatorId)?.votes ?? 0;
    const shareA = total > 0 ? votes / total : 0;
    // Round to 0.01pt (4 decimal places of share) so near-zero float noise from two
    // independent divisions — e.g. -0.00000000003 — collapses to an exact 0 rather than
    // displaying as "-0.0pt" and missing the `=== 0` neutral-color check downstream.
    const delta = Math.round((shareB - shareA) * 10000) / 10000;
    result.set(psgc, { share_a: shareA, share_b: shareB, delta });
  }
  return result;
}

export type ProvinceSwingHeadline = {
  senatorName: string;
  yearA: number;
  yearB: number;
  /** Top-7 sample (same quartileSample used by ProvinceSwingBarChart), so the share graphic
   *  shows exactly the same bars the user saw on the chart they clicked Share from. */
  sample: { adm2_en: string; delta: number; label: string }[];
  /** Plain-text headline for metadata/alt text (og:title, twitter:description, img alt) — no
   *  markup, since those contexts can't render highlighted spans. */
  headline: string;
  /** Same claim as `headline`, split into segments so renderers (ImageResponse, JSX) can
   *  highlight the verb + count in the swing's color without re-deriving the copy logic or
   *  duplicating the lose/gain/mixed branching. Concatenating all `text` fields in order
   *  reproduces `headline`. */
  headlineParts: { text: string; emphasis?: 'gain' | 'loss' }[];
  /** Full-dataset breakdown (not just the 7-item sample) — this is what the headline's
   *  count/percentage claim is actually measured against, so "111 out of 113" is a real
   *  count across every province/city the candidate meaningfully contested, not the sample. */
  breadth: { total: number; losing: number; gaining: number; direction: 'loss' | 'gain' | 'mixed' };
  /** The single biggest mover in the full (unsampled) province list — may differ from
   *  sample[0] only in edge cases where quartileSample's dedup shifts the picks; in practice
   *  these agree because biggest-drop is always sample position 0. */
  biggestMove: { adm2_en: string; shareA: number; shareB: number; delta: number };
};

// Builds the programmatic "province swing" headline for a candidate's two most recent runs —
// works identically for any candidate with 2+ runs and at least one province where they earned
// a real vote share, well-known or not. Returns null when the candidate doesn't qualify (single
// run, or no province crossed a non-trivial share in either year) — callers must not fabricate
// a story when this returns null.
//
// The breadth claim ("lost support in 111 out of 113 provinces") is counted across the full
// province list, not just the 7-item chart sample — an earlier version judged "did support move
// the same way everywhere" from the sample alone, which could call a candidate's swing "mixed"
// even when 98% of their full province list agreed, just because the 7 sampled quantile points
// happened to include one outlier. This mirrors how outlets like the NYT/AP/ABC reported the
// 2024 US election's county-level swing ("Republicans gained in 2,778 of 3,112 counties") —
// a real count over the full set, not an extrapolation from a handful of examples.
// Resolves which year pair a province-swing share view should compare: honors an explicit
// ?yearA=&yearB= query (so a share link reproduces whichever pair the user had selected via
// SwingYearPairSelector when they clicked Share) as long as both years are ones the candidate
// actually ran in, falling back to their most recent consecutive pair otherwise — e.g. for
// direct/organic visits with no query, or a query naming years the candidate didn't run in.
export function resolveShareYearPair(
  senator: Senator,
  query: { yearA?: string; yearB?: string }
): [number, number] | null {
  const runs = [...senator.years].sort((a, b) => a - b);
  if (runs.length < 2) return null;
  const queryA = query.yearA ? parseInt(query.yearA, 10) : undefined;
  const queryB = query.yearB ? parseInt(query.yearB, 10) : undefined;
  if (queryA !== undefined && queryB !== undefined && runs.includes(queryA) && runs.includes(queryB)) {
    return [queryA, queryB];
  }
  return [runs[runs.length - 2], runs[runs.length - 1]];
}

export function provinceSwingHeadline(
  voteDataA: VoteData,
  voteDataB: VoteData,
  senator: Senator,
  yearA: number,
  yearB: number
): ProvinceSwingHeadline | null {
  const rows = provinceSwing(voteDataA, voteDataB, senator.senator_id)
    .filter(r => r.share_a >= 0.03 || r.share_b >= 0.03); // ignore places they barely competed in either year
  if (rows.length === 0) return null;

  const sample = quartileSample(rows, r => r.adm2_en, 7).map(({ row, label }) => ({
    adm2_en: row.adm2_en,
    delta: row.delta,
    label,
  }));

  const biggestRow = rows[0].delta < 0 || Math.abs(rows[0].delta) >= Math.abs(rows[rows.length - 1].delta)
    ? rows[0]
    : rows[rows.length - 1];
  const biggestMove = {
    adm2_en: biggestRow.adm2_en,
    shareA: biggestRow.share_a,
    shareB: biggestRow.share_b,
    delta: biggestRow.delta,
  };

  const name = headlineName(senator.senator_name);
  const total = rows.length;
  const losing = rows.filter(r => r.delta < 0).length;
  const gaining = total - losing;
  const losingPct = losing / total;

  // >50% one way or the other reads as a real trend; anywhere closer than that is genuinely
  // split and shouldn't be flattened into a one-sided claim (see the mixed-swing question this
  // threshold answers — a 55/45 split isn't "lost support", it's "support was mixed").
  const direction: 'loss' | 'gain' | 'mixed' =
    losingPct > 0.5 ? 'loss' : losingPct < 0.5 ? 'gain' : 'mixed';

  let headlineParts: { text: string; emphasis?: 'gain' | 'loss' }[];
  if (direction === 'mixed') {
    headlineParts = [
      { text: `${name}'s support was mixed` },
      { text: ` — falling in ${losing} and rising in ${gaining} of ${total} provinces/cities` },
      { text: ` between ${yearA} and ${yearB}.` },
    ];
  } else {
    const count = direction === 'loss' ? losing : gaining;
    const pct = Math.round((count / total) * 100);
    const verb = direction === 'loss' ? 'lost' : 'gained';
    headlineParts = [
      { text: `${name} ` },
      { text: verb, emphasis: direction },
      { text: ' support from ' },
      { text: `${count} out of ${total} (${pct}%)`, emphasis: direction },
      { text: ` provinces/cities between ${yearA} and ${yearB} elections.` },
    ];
  }
  const headline = headlineParts.map(p => p.text).join('');

  return {
    senatorName: senator.senator_name,
    yearA,
    yearB,
    sample,
    headline,
    headlineParts,
    breadth: { total, losing, gaining, direction },
    biggestMove,
  };
}

// ── New per-candidate helper functions ───────────────────────────────────────────────────────
// Rewritten counterparts of the functions above, operating on CandidateData (one candidate,
// every year they ran) instead of VoteData (one year, every candidate) — since a candidate file
// already carries only its own votes/share/rank, these are pure reads/sorts with no scanning
// across other candidates. Named with a `candidate` prefix for now so they coexist with the
// VoteData-based versions above; the prefix drops once those old versions are removed and every
// caller has switched over (see migration plan).

// Top N municipalities for a senator in a given year, sorted by vote_share desc.
export function candidateTopMunicipalities(
  candidate: CandidateData,
  year: number,
  n = 5
) {
  const yearData = candidate.years[String(year)];
  if (!yearData) return [];
  return Object.entries(yearData.municipalities)
    .map(([psgc, m]) => ({
      psgc, adm3_en: m.adm3_en, adm2_en: m.adm2_en,
      votes: m.votes, vote_share: m.vote_share, rank: m.rank,
    }))
    .sort((a, b) => b.vote_share - a.vote_share)
    .slice(0, n);
}

// Top N provinces for a senator in a given year, sorted by vote_share desc — now a pure read of
// the precomputed provinces block, no aggregation needed.
export function candidateTopProvinces(
  candidate: CandidateData,
  year: number,
  n = 5
) {
  const yearData = candidate.years[String(year)];
  if (!yearData?.provinces) return [];
  return Object.entries(yearData.provinces)
    .map(([adm2_en, p]) => ({ adm2_en, votes: p.votes, vote_share: p.vote_share, rank: p.rank }))
    .sort((a, b) => b.vote_share - a.vote_share)
    .slice(0, n);
}

// Vote share per year for a senator (for the trend chart). nationalTotalsByYear supplies the
// "total votes cast nationally that year, across every candidate" denominator — build it by
// summing national_{year}.json via nationalTotalVotes() for each year the candidate ran.
export function candidateTrendData(
  candidate: CandidateData,
  nationalTotalsByYear: Map<number, number>
): { year: number; vote_share: number }[] {
  return Object.entries(candidate.years)
    .map(([yearStr, yearData]) => {
      const year = Number(yearStr);
      const total = nationalTotalsByYear.get(year) ?? 0;
      return { year, vote_share: total > 0 ? yearData.national_votes / total : 0 };
    })
    .sort((a, b) => a.year - b.year);
}

// Sorted list of every province (adm2_en) this candidate has data for in a given year.
export function candidateProvinceList(candidate: CandidateData, year: number): string[] {
  const yearData = candidate.years[String(year)];
  if (!yearData?.provinces) return [];
  return Object.keys(yearData.provinces).sort();
}

// A senator's vote share within one province, per year they ran — the province swing trend
// line. Also carries that year's national vote share (see candidateTrendData) so callers can
// express province performance as an index relative to the candidate's own national average.
export function candidateProvinceShareTrend(
  candidate: CandidateData,
  nationalTotalsByYear: Map<number, number>,
  adm2_en: string
): { year: number; vote_share: number; national_share: number }[] {
  const result: { year: number; vote_share: number; national_share: number }[] = [];
  for (const [yearStr, yearData] of Object.entries(candidate.years)) {
    const year = Number(yearStr);
    const provinceEntry = yearData.provinces?.[adm2_en];
    if (!provinceEntry) continue;
    const total = nationalTotalsByYear.get(year) ?? 0;
    result.push({
      year,
      vote_share: provinceEntry.vote_share,
      national_share: total > 0 ? yearData.national_votes / total : 0,
    });
  }
  return result.sort((a, b) => a.year - b.year);
}

// Per-province vote-share swing for a senator across every province they have data for, between
// two years — sorted by delta ascending (biggest drop first), same shape as
// candidateMunicipalitySwing one level up.
export function candidateProvinceSwing(
  candidate: CandidateData,
  yearA: number,
  yearB: number
): { adm2_en: string; share_a: number; share_b: number; delta: number }[] {
  const dataA = candidate.years[String(yearA)];
  const dataB = candidate.years[String(yearB)];
  if (!dataA?.provinces || !dataB?.provinces) return [];
  return Object.entries(dataA.provinces)
    .flatMap(([adm2_en, provA]) => {
      const provB = dataB.provinces![adm2_en];
      if (!provB) return [];
      // Round to 0.01pt so near-zero float noise collapses to an exact 0.
      const delta = Math.round((provB.vote_share - provA.vote_share) * 10000) / 10000;
      return [{ adm2_en, share_a: provA.vote_share, share_b: provB.vote_share, delta }];
    })
    .sort((a, b) => a.delta - b.delta);
}

// Per-municipality vote-share swing for a senator within one province, between two years —
// sorted by delta ascending (biggest drop first). Pure read of precomputed vote_share, no
// cross-candidate aggregation needed.
export function candidateMunicipalitySwing(
  candidate: CandidateData,
  yearA: number,
  yearB: number,
  adm2_en: string
): { psgc: string; adm3_en: string; share_a: number; share_b: number; delta: number }[] {
  const dataA = candidate.years[String(yearA)];
  const dataB = candidate.years[String(yearB)];
  if (!dataA || !dataB) return [];
  return Object.entries(dataA.municipalities)
    .filter(([, m]) => m.adm2_en === adm2_en)
    .flatMap(([psgc, mA]) => {
      const mB = dataB.municipalities[psgc];
      if (!mB || mB.adm2_en !== adm2_en) return [];
      const delta = Math.round((mB.vote_share - mA.vote_share) * 10000) / 10000;
      return [{ psgc, adm3_en: mA.adm3_en, share_a: mA.vote_share, share_b: mB.vote_share, delta }];
    })
    .sort((a, b) => a.delta - b.delta);
}

// Vote-share swing for a senator across every municipality they have data for, between two
// years — the map-wide counterpart to candidateMunicipalitySwing (no province filter), keyed by
// psgc for direct lookup per map feature.
export function candidateNationwideMunicipalitySwing(
  candidate: CandidateData,
  yearA: number,
  yearB: number
): Map<string, { share_a: number; share_b: number; delta: number }> {
  const dataA = candidate.years[String(yearA)];
  const dataB = candidate.years[String(yearB)];
  const result = new Map<string, { share_a: number; share_b: number; delta: number }>();
  if (!dataA || !dataB) return result;
  for (const [psgc, mA] of Object.entries(dataA.municipalities)) {
    const mB = dataB.municipalities[psgc];
    if (!mB) continue;
    const delta = Math.round((mB.vote_share - mA.vote_share) * 10000) / 10000;
    result.set(psgc, { share_a: mA.vote_share, share_b: mB.vote_share, delta });
  }
  return result;
}

// Builds the programmatic "province swing" headline for a candidate's two most recent runs —
// candidate-scoped counterpart of provinceSwingHeadline above. Same logic, just calls
// candidateProvinceSwing instead of the VoteData-pair version.
export function candidateProvinceSwingHeadline(
  candidate: CandidateData,
  senator: Senator,
  yearA: number,
  yearB: number
): ProvinceSwingHeadline | null {
  const rows = candidateProvinceSwing(candidate, yearA, yearB)
    .filter(r => r.share_a >= 0.03 || r.share_b >= 0.03); // ignore places they barely competed in either year
  if (rows.length === 0) return null;

  // 15 rows fills the og-image's bar-chart column edge-to-edge at its current row height —
  // tied to that specific layout, not a generically "right" sample size, so if the image's
  // row height/gap changes this constant should move with it.
  const sample = quartileSample(rows, r => r.adm2_en, Math.min(rows.length, 15)).map(({ row, label }) => ({
    adm2_en: row.adm2_en,
    delta: row.delta,
    label,
  }));

  const biggestRow = rows[0].delta < 0 || Math.abs(rows[0].delta) >= Math.abs(rows[rows.length - 1].delta)
    ? rows[0]
    : rows[rows.length - 1];
  const biggestMove = {
    adm2_en: biggestRow.adm2_en,
    shareA: biggestRow.share_a,
    shareB: biggestRow.share_b,
    delta: biggestRow.delta,
  };

  const name = headlineName(senator.senator_name);
  const total = rows.length;
  const losing = rows.filter(r => r.delta < 0).length;
  const gaining = total - losing;
  const losingPct = losing / total;

  const direction: 'loss' | 'gain' | 'mixed' =
    losingPct > 0.5 ? 'loss' : losingPct < 0.5 ? 'gain' : 'mixed';

  let headlineParts: { text: string; emphasis?: 'gain' | 'loss' }[];
  if (direction === 'mixed') {
    headlineParts = [
      { text: `${name}'s support was mixed` },
      { text: ` — falling in ${losing} and rising in ${gaining} of ${total} provinces/cities` },
      { text: ` between ${yearA} and ${yearB}.` },
    ];
  } else {
    const count = direction === 'loss' ? losing : gaining;
    const pct = Math.round((count / total) * 100);
    const verb = direction === 'loss' ? 'lost' : 'gained';
    headlineParts = [
      { text: `${name} ` },
      { text: verb, emphasis: direction },
      { text: ' support from ' },
      { text: `${count} out of ${total} (${pct}%)`, emphasis: direction },
      { text: ` provinces/cities between ${yearA} and ${yearB} elections.` },
    ];
  }
  const headline = headlineParts.map(p => p.text).join('');

  return {
    senatorName: senator.senator_name,
    yearA,
    yearB,
    sample,
    headline,
    headlineParts,
    breadth: { total, losing, gaining, direction },
    biggestMove,
  };
}
