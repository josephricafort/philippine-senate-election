import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { VoteData, CandidateIndex } from './types';
import { ELECTION_YEARS } from './types';

// Server-only counterparts to lib/data.ts's fetch-based loaders — these read
// straight off disk so they work in generateStaticParams, opengraph-image,
// and other build-time contexts where there's no request origin to fetch from.
//
// Cached at module scope (not React.cache(), which is request-scoped) because
// generateStaticParams builds 260+ pages across parallel workers — without a
// process-lifetime cache, every single page + its opengraph-image re-parses
// all ~44MB of vote JSON from scratch, and under concurrent static export that
// compounds into pages blowing past their build timeout.

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

let allVotesPromise: Promise<Map<number, VoteData>> | undefined;
export function loadAllVotesServer(): Promise<Map<number, VoteData>> {
  if (!allVotesPromise) {
    allVotesPromise = Promise.all(ELECTION_YEARS.map(y => loadVotesServer(y))).then(results => {
      const map = new Map<number, VoteData>();
      ELECTION_YEARS.forEach((y, i) => map.set(y, results[i]));
      return map;
    });
  }
  return allVotesPromise;
}
