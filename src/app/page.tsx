'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import SearchSelect from '@/components/SearchSelect';
import CandidateCard from '@/components/CandidateCard';
import YearSelector from '@/components/YearSelector';
import MetricToggle from '@/components/MetricToggle';
import TopMunicipalitiesTable from '@/components/TopMunicipalitiesTable';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import LeaderboardTable from '@/components/LeaderboardTable';

import {
  loadVotes, loadCandidateIndex, buildSenatorList, topMunicipalities, trendData,
} from '@/lib/data';
import {
  ELECTION_YEARS, type ElectionYear, type Metric, type Senator, type VoteData,
} from '@/lib/types';

// Browser-only components — SSR-disabled to avoid DOM/ResizeObserver errors
const ChoroplethMap = dynamic(() => import('@/components/ChoroplethMap'), { ssr: false });
const TrendChart = dynamic(() => import('@/components/TrendChart'), { ssr: false });

type Tab = 'map' | 'leaderboard';

export default function ExplorerPage() {
  const [senators, setSenators] = useState<Senator[]>([]);
  const [selectedSenator, setSelectedSenator] = useState<Senator | null>(null);
  const [year, setYear] = useState<ElectionYear>(2025);
  const [metric, setMetric] = useState<Metric>('rank');
  const [tab, setTab] = useState<Tab>('map');

  // When a senator is selected, auto-switch to their most recent year if current year unavailable
  function handleSelectSenator(s: Senator | null) {
    setSelectedSenator(s);
    if (!s) return;
    const senatorYears = s.years.map(Number);
    if (!senatorYears.includes(year)) {
      // Pick their most recent year, or closest to current
      const best = senatorYears.reduce((prev, cur) =>
        Math.abs(cur - year) < Math.abs(prev - year) ? cur : prev
      );
      setYear(best as ElectionYear);
    }
  }

  // Vote data cache keyed by year
  const [voteCache, setVoteCache] = useState<Map<number, VoteData>>(new Map());
  const [loading, setLoading] = useState(false);

  // Load candidate index once and default to Legarda
  useEffect(() => {
    loadCandidateIndex().then(idx => {
      const list = buildSenatorList(idx);
      setSenators(list);
      const legarda = list.find(s => s.senator_id === 'legarda_loren');
      if (legarda) {
        setSelectedSenator(legarda);
        setYear(2022); // most recent year she ran
      }
    });
  }, []);


  // Pre-load all years on mount
  useEffect(() => {
    setLoading(true);
    Promise.all(ELECTION_YEARS.map(y => loadVotes(y)))
      .then(results => {
        const map = new Map<number, VoteData>();
        ELECTION_YEARS.forEach((y, i) => map.set(y, results[i]));
        setVoteCache(map);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentVoteData = voteCache.get(year) ?? null;

  const topMunis = selectedSenator && currentVoteData
    ? topMunicipalities(currentVoteData, selectedSenator.senator_id, 15)
    : [];

  const trend = selectedSenator
    ? trendData(voteCache, selectedSenator.senator_id)
    : [];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b px-6 py-3 flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold leading-tight">
            Philippine Senate Election Explorer
          </h1>
          <p className="text-xs text-muted-foreground">Municipality-level results · 2007–2025</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {loading && <span className="animate-pulse">Loading data…</span>}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <aside className="w-120 shrink-0 border-r flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <SearchSelect
              senators={senators}
              value={selectedSenator}
              onChange={handleSelectSenator}
            />

            {selectedSenator ? (
              <>
                <CandidateCard
                  senator={selectedSenator}
                  voteData={currentVoteData}
                  year={year}
                />

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    Vote share trend
                  </p>
                  <TrendChart data={trend} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    Top municipalities · {year}
                  </p>
                  {currentVoteData
                    ? <TopMunicipalitiesTable rows={topMunis} />
                    : <p className="text-muted-foreground text-sm">Loading…</p>
                  }
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">Search for a candidate<br />to explore their results</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Controls bar */}
          <div className="shrink-0 border-b px-4 py-2 flex items-center gap-3 flex-wrap">
            <YearSelector
              value={year}
              onChange={setYear}
              availableYears={tab === 'map' ? selectedSenator?.years.map(Number) : undefined}
            />
            <Separator orientation="vertical" className="h-4" />
            <MetricToggle value={metric} onChange={setMetric} />
            <div className="ml-auto flex gap-1">
              <Button
                variant={tab === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTab('map')}
              >
                🗺 Map
              </Button>
              <Button
                variant={tab === 'leaderboard' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTab('leaderboard')}
              >
                📊 Leaderboard
              </Button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {tab === 'map' ? (
              <ChoroplethMap
                voteData={currentVoteData}
                senatorId={selectedSenator?.senator_id ?? null}
                metric={metric}
              />
            ) : (
              <div className="h-full overflow-hidden">
                {currentVoteData ? (
                  <LeaderboardTable
                    voteData={currentVoteData}
                    senators={senators}
                    highlightId={selectedSenator?.senator_id ?? null}
                    metric={metric}
                  />
                ) : (
                  <p className="text-zinc-600 text-sm p-4">Loading…</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
