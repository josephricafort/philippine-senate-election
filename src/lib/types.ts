export type Metric = 'vote_share' | 'rank' | 'votes' | 'swing';

export const ELECTION_YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025] as const;
export type ElectionYear = typeof ELECTION_YEARS[number];

export type MunicipalityCandidate = {
  senator_id: string;
  votes: number;
  vote_share: number;
  rank: number;
};

export type MunicipalityVotes = {
  adm3_en: string;
  adm2_en: string;
  candidates: MunicipalityCandidate[];
};

export type NationalTotals = {
  national_votes: number;
  national_rank: number;
};

export type VoteData = {
  year: number;
  municipalities: Record<string, MunicipalityVotes>;
  national: Record<string, NationalTotals>;
};

export type CandidateEntry = {
  senator_id: string;
  senator_name: string;
  years: string[];
};

export type CandidateIndex = CandidateEntry[];

// Unique senator (across all years)
export type Senator = {
  senator_id: string;
  senator_name: string;
  years: number[];
};

// ── Per-candidate data (public/data/candidates/{senator_id}.json) ───────────────────────────
// Replaces VoteData as the primary client/server data source — each file already holds only
// one candidate's own numbers, so callers never need to scan across all 268 candidates.

export type CandidateMunicipality = {
  adm3_en: string;
  adm2_en: string;
  votes: number;
  vote_share: number;
  rank: number;
};

// Province-level aggregate per candidate — not present in the data yet (see provinces? below);
// pending a follow-up data-gen pass, tracked as an open item.
export type CandidateProvince = {
  votes: number;
  vote_share: number;
  rank: number;
};

export type CandidateYearData = {
  national_votes: number;
  national_rank: number;
  municipalities: Record<string, CandidateMunicipality>; // keyed by adm3_psgc
  provinces?: Record<string, CandidateProvince>; // keyed by adm2_en — awaiting data-gen follow-up
};

export type CandidateData = {
  senator_id: string;
  senator_name: string;
  years: Record<string, CandidateYearData>; // keyed by year, e.g. "2019"
};

// national_{year}.json — every candidate who ran that year, keyed by senator_id
export type NationalYearEntry = NationalTotals;
export type NationalYearData = Record<string, NationalYearEntry>;

// municipality_names.json — candidate-independent psgc -> name lookup, used where a name is
// needed regardless of whether the selected candidate has a data entry for that municipality
export type MunicipalityNames = Record<string, { adm3_en: string; adm2_en: string }>;
