import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { VoteData, CandidateIndex } from './types';

// Server-only counterparts to lib/data.ts's fetch-based loaders — these read
// straight off disk so they work in generateStaticParams, opengraph-image,
// and other build-time contexts where there's no request origin to fetch from.
//
// Cached at module scope (not React.cache(), which is request-scoped) because
// generateStaticParams builds 260+ pages across parallel workers — without a
// process-lifetime cache, every page + its opengraph-image would re-parse the
// same year's vote JSON from scratch. Callers only request the years a given
// senator actually ran in (see loadVotesForYearsServer below) rather than all
// ELECTION_YEARS, so a single worker never has to hold all ~44MB of vote JSON
// in memory at once — that full-dataset load was blowing out build memory.

const dataDir = path.join(process.cwd(), 'public', 'data');

let candidateIndexPromise: Promise<CandidateIndex> | undefined;
export function loadCandidateIndexServer(): Promise<CandidateIndex> {
  if (!candidateIndexPromise) {
    candidateIndexPromise = readFile(path.join(dataDir, 'candidate_index.json'), 'utf-8')
      .then(raw => JSON.parse(raw));
  }
  return candidateIndexPromise;
}

const votesPromiseCache = new Map<number, Promise<VoteData>>();
export function loadVotesServer(year: number): Promise<VoteData> {
  let promise = votesPromiseCache.get(year);
  if (!promise) {
    promise = readFile(path.join(dataDir, `votes_${year}.json`), 'utf-8').then(raw => JSON.parse(raw));
    votesPromiseCache.set(year, promise);
  }
  return promise;
}

// Loads only the requested years — callers pass a senator's own runs (or a resolved year
// pair) so static generation never holds more of the ~44MB vote dataset in memory per
// page/worker than that page actually needs.
export async function loadVotesForYearsServer(years: number[]): Promise<Map<number, VoteData>> {
  const uniqueYears = Array.from(new Set(years));
  const results = await Promise.all(uniqueYears.map(y => loadVotesServer(y)));
  const map = new Map<number, VoteData>();
  uniqueYears.forEach((y, i) => map.set(y, results[i]));
  return map;
}
