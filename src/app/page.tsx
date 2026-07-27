'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronRight, Map as MapIcon, Share2, Vote } from 'lucide-react';

import SearchSelect from '@/components/SearchSelect';
import CandidateCard from '@/components/CandidateCard';
import YearSelector from '@/components/YearSelector';
import MetricToggle from '@/components/MetricToggle';
import TopMunicipalitiesTable from '@/components/TopMunicipalitiesTable';
import TopProvincesTable from '@/components/TopProvincesTable';
import LeaderboardTable from '@/components/LeaderboardTable';
import InfoMenu from '@/components/InfoMenu';
import SwingSection from '@/components/SwingSection';

type MobileTab = 'leaderboard' | 'profile' | 'map';

import {
  loadVotes, loadCandidateIndex, buildSenatorList, topMunicipalities, topProvinces, trendData,
} from '@/lib/data';
import {
  ELECTION_YEARS, type ElectionYear, type Metric, type Senator, type VoteData,
} from '@/lib/types';

// Browser-only components — SSR-disabled to avoid DOM/ResizeObserver errors
const ChoroplethMap = dynamic(() => import('@/components/ChoroplethMap'), { ssr: false });
const TrendChart = dynamic(() => import('@/components/TrendChart'), { ssr: false });

export default function ExplorerPage() {
  const [senators, setSenators] = useState<Senator[]>([]);
  const [selectedSenator, setSelectedSenator] = useState<Senator | null>(null);
  const [year, setYear] = useState<ElectionYear>(2025);
  const [metric, setMetric] = useState<Metric>('rank');
  const [mobileTab, setMobileTab] = useState<MobileTab>('leaderboard');

  function handleSelectFromLeaderboard(s: Senator) {
    handleSelectSenator(s);
    setMobileTab('profile');
  }

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

  // Load candidate index once and default to Bong Go
  useEffect(() => {
    loadCandidateIndex().then(idx => {
      const list = buildSenatorList(idx);
      setSenators(list);
      const bongGo = list.find(s => s.senator_id === 'go_bong');
      if (bongGo) {
        setSelectedSenator(bongGo);
        setYear(2025);
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
    ? topMunicipalities(currentVoteData, selectedSenator.senator_id, 7)
    : [];

  const topProvs = selectedSenator && currentVoteData
    ? topProvinces(currentVoteData, selectedSenator.senator_id, 7)
    : [];

  const trend = selectedSenator
    ? trendData(voteCache, selectedSenator.senator_id)
    : [];

  const didRunSelectedYear = !!(currentVoteData && selectedSenator && currentVoteData.national[selectedSenator.senator_id]);

  // Top 3 candidates who did run this year — offered as a way out of the dead end
  // when the selected senator didn't run in `year`
  const topCandidatesThisYear = (!didRunSelectedYear && currentVoteData && selectedSenator)
    ? senators
        .filter(s => currentVoteData.national[s.senator_id])
        .sort((a, b) => currentVoteData.national[a.senator_id].national_rank - currentVoteData.national[b.senator_id].national_rank)
        .slice(0, 3)
    : [];

  const profilePanel = (
    <div className="p-4 space-y-6 md:space-y-8">
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
            onSelectYear={setYear}
          />

          <div className="flex items-center gap-3 -mt-3">
            {didRunSelectedYear && (
              /* Compact shortcut to the years this candidate ran in — updates the shared year state */
              <>
                <span className="text-xs text-muted-foreground font-medium shrink-0">Years Ran</span>
                <YearSelector
                  value={year}
                  onChange={setYear}
                  availableYears={selectedSenator.years}
                  filterToAvailable
                />
              </>
            )}
            <Link
              href={`/senator/${selectedSenator.senator_id}`}
              title="View shareable profile page"
              aria-label="View shareable profile page"
              className="ml-auto flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Link>
          </div>

          <button
            onClick={() => setMobileTab('map')}
            className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent transition-colors md:hidden"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium leading-snug">
              See rank of votes per municipality for {selectedSenator.senator_name}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {didRunSelectedYear ? (
            <>
              {voteCache.size === ELECTION_YEARS.length && (
                <SwingSection
                  senator={selectedSenator}
                  voteCache={voteCache}
                  latestVoteData={voteCache.get(Math.max(...selectedSenator.years)) ?? null}
                />
              )}

              {/* Vote share trend — only meaningful with 2+ runs; hidden for one-time candidates */}
              {selectedSenator.years.length > 1 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
                    National vote trends
                  </p>
                  <TrendChart data={trend} />
                </div>
              )}

              {currentVoteData ? (
                <TopProvincesTable rows={topProvs} metric={metric} year={year} />
              ) : (
                <p className="text-muted-foreground text-sm">Loading…</p>
              )}

              {currentVoteData ? (
                <TopMunicipalitiesTable rows={topMunis} metric={metric} year={year} />
              ) : (
                <p className="text-muted-foreground text-sm">Loading…</p>
              )}
            </>
          ) : (
            topCandidatesThisYear.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
                  Top candidates in {year}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topCandidatesThisYear.map(s => (
                    <button
                      key={s.senator_id}
                      onClick={() => handleSelectSenator(s)}
                      className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                    >
                      #{currentVoteData!.national[s.senator_id].national_rank} {s.senator_name}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
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
  );

  // ── Mobile-only panel variants ──
  // Map: rank/share/votes metric toggle, plus a year selector (when the selected
  // candidate ran in more than one year) so users can compare years without leaving the map.
  // Reuses the same YearSelector styling as the Leaderboard tab for visual consistency.
  const mobileMapPanel = (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {selectedSenator && selectedSenator.years.length > 1 && (
        <div className="shrink-0 border-b px-4 py-2 overflow-x-auto">
          <YearSelector
            value={year}
            onChange={setYear}
            availableYears={selectedSenator.years}
            filterToAvailable
          />
        </div>
      )}
      <div className="shrink-0 border-b px-4 py-2 flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium shrink-0">View By</span>
        <MetricToggle value={metric} onChange={setMetric} />
      </div>
      <div className="flex-1 overflow-hidden">
        <ChoroplethMap
          voteData={currentVoteData}
          senatorId={selectedSenator?.senator_id ?? null}
          senatorName={selectedSenator?.senator_name ?? null}
          year={year}
          metric={metric}
          onNavigateToProfile={() => setMobileTab('profile')}
        />
      </div>
    </div>
  );

  // Leaderboard: year selector pinned at top; tapping a candidate row navigates to Profile.
  const mobileLeaderboardPanel = (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2">
        <YearSelector value={year} onChange={setYear} />
      </div>
      <div className="flex-1 overflow-hidden">
        {currentVoteData ? (
          <LeaderboardTable
            voteData={currentVoteData}
            senators={senators}
            highlightId={selectedSenator?.senator_id ?? null}
            onSelectSenator={handleSelectFromLeaderboard}
          />
        ) : (
          <p className="text-zinc-600 text-sm p-4">Loading…</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Vote className="w-6 h-6 text-primary shrink-0" strokeWidth={2} />
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Philippine Senate Election Explorer
            </h1>
            <p className="text-xs text-muted-foreground">Municipality-level results · 2007–2025</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {loading && <span className="animate-pulse">Loading data…</span>}
          <InfoMenu />
        </div>
      </header>

      {/* ── Desktop layout (md+): full-width year bar + 3 columns — Leaderboard | Profile | Map ── */}
      <div className="hidden md:flex md:flex-col flex-1 overflow-hidden">
        {/* Full-width year bar — py-3 (vs. py-2 elsewhere) matches MetricToggle's extra
            internal p-1 wrapper padding, so this bar is the same height as the metric
            toggle bar in column 3 */}
        <div className="shrink-0 border-b px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Election Years</span>
          <YearSelector value={year} onChange={setYear} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: leaderboard */}
          <section className="w-96 shrink-0 border-r flex flex-col overflow-hidden">
            {currentVoteData ? (
              <LeaderboardTable
                voteData={currentVoteData}
                senators={senators}
                highlightId={selectedSenator?.senator_id ?? null}
                onSelectSenator={handleSelectFromLeaderboard}
              />
            ) : (
              <p className="text-zinc-600 text-sm p-4">Loading…</p>
            )}
          </section>

          {/* Column 2: candidate profile */}
          <aside className="w-120 shrink-0 border-r flex flex-col overflow-y-auto">
            {profilePanel}
          </aside>

          {/* Column 3: metric toggle + map */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 border-b px-4 py-2 flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium shrink-0">View By</span>
              <MetricToggle value={metric} onChange={setMetric} />
            </div>
            <div className="flex-1 overflow-hidden">
              <ChoroplethMap
                voteData={currentVoteData}
                senatorId={selectedSenator?.senator_id ?? null}
                senatorName={selectedSenator?.senator_name ?? null}
                year={year}
                metric={metric}
              />
            </div>
          </main>
        </div>
      </div>

      {/* ── Mobile layout (< md): full-screen panels + bottom tab bar ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Active panel — profile scrolls, map/leaderboard fill height */}
        <div className={`flex-1 flex flex-col ${mobileTab === 'profile' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}>
          {mobileTab === 'leaderboard' && mobileLeaderboardPanel}
          {mobileTab === 'profile' && profilePanel}
          {mobileTab === 'map' && mobileMapPanel}
        </div>

        {/* Bottom tab bar — order: Leaderboard, Profile, Map */}
        <nav className="shrink-0 border-t bg-background flex items-stretch">
          <button
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'leaderboard' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('leaderboard')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 10h18M3 14h18M10 4v16M14 4v16M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
            </svg>
            Leaderboard
          </button>

          <button
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'profile' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('profile')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
            </svg>
            Profile
          </button>

          <button
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'map' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMobileTab('map')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13V7m0 13 6-3M9 7l6-3m0 0 5.553 2.724A1 1 0 0 1 21 7.618v10.764a1 1 0 0 1-.553.894L15 22m0-18v18" />
            </svg>
            Map
          </button>
        </nav>
      </div>
    </div>
  );
}
