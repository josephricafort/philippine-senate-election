export type Metric = 'vote_share' | 'rank' | 'votes';

export const ELECTION_YEARS = [2007, 2013, 2016, 2019, 2022, 2025] as const;
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
