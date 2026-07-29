'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, Map as MapIcon, Share2, Vote } from 'lucide-react';

import SearchSelect from '@/components/SearchSelect';
import CandidateCard, { CandidateHeader } from '@/components/CandidateCard';
import YearSelector from '@/components/YearSelector';
import MetricToggle from '@/components/MetricToggle';
import TopMunicipalitiesTable from '@/components/TopMunicipalitiesTable';
import TopProvincesTable from '@/components/TopProvincesTable';
import LeaderboardTable from '@/components/LeaderboardTable';
import InfoMenu from '@/components/InfoMenu';
import SwingSection from '@/components/SwingSection';
import SwingYearPairSelector from '@/components/SwingYearPairSelector';

type MobileTab = 'leaderboard' | 'profile' | 'map';
type ProfileTab = 'swing' | 'trends';

import {
  loadCandidateData, loadNationalYear, loadMunicipalityNames, loadCandidateIndex,
  buildSenatorList, nationalTotalVotes,
  candidateTopMunicipalities, candidateTopProvinces, candidateTrendData,
  candidateNationwideMunicipalitySwing, candidateProvinceList, candidateProvinceShareTrend,
  candidateProvinceSwing, candidateMunicipalitySwing, resolveShareYearPair,
} from '@/lib/data';
import {
  type ElectionYear, type Metric, type Senator,
  type CandidateData, type NationalYearData, type MunicipalityNames,
} from '@/lib/types';
import { trackEvent } from '@/lib/analytics';
import { consecutivePairs, type YearPair } from '@/lib/swing';

// Browser-only components — SSR-disabled to avoid DOM/ResizeObserver errors
const ChoroplethMap = dynamic(() => import('@/components/ChoroplethMap'), { ssr: false });
const TrendChart = dynamic(() => import('@/components/TrendChart'), { ssr: false });

export default function ExplorerClient() {
  return (
    <Suspense fallback={null}>
      <ExplorerPageInner />
    </Suspense>
  );
}

function ExplorerPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const candidateParam = searchParams.get('candidate');
  // Present on links shared from the map/province swing-share cards — reproduces the exact
  // year pair those cards depicted, instead of defaulting to the candidate's most recent pair.
  const yearAParam = searchParams.get('yearA');
  const yearBParam = searchParams.get('yearB');
  const [senators, setSenators] = useState<Senator[]>([]);
  const [selectedSenator, setSelectedSenator] = useState<Senator | null>(null);
  const [year, setYear] = useState<ElectionYear>(2025);
  const [metric, setMetric] = useState<Metric>('swing');
  const [mobileTab, setMobileTab] = useState<MobileTab>('leaderboard');
  const [profileTab, setProfileTab] = useState<ProfileTab>('swing');
  // Which consecutive pair of runs the Swing view compares — independent of `year`, since a
  // swing pair spans two elections. Defaults to the candidate's most recent pair; reset whenever
  // the selected candidate changes (a stale pair from a previous candidate has no meaning here).
  const [swingYearPair, setSwingYearPair] = useState<YearPair | null>(null);

  function handleSelectFromLeaderboard(s: Senator) {
    handleSelectSenator(s, 'leaderboard_row');
    setMobileTab('profile');
  }

  // When a senator is selected, auto-switch to their most recent year if current year unavailable
  function handleSelectSenator(s: Senator | null, source: 'search' | 'leaderboard_row' | 'year_pill' | 'suggestion_chip' | 'url_param' = 'search') {
    setSelectedSenator(s);

    // Keep ?candidate= in sync with the current selection (except when it's just replaying
    // the param we were already given) so the explorer view is shareable/bookmarkable —
    // replace (not push) so every candidate click doesn't pile up browser-history entries.
    if (source !== 'url_param') {
      const params = new URLSearchParams(searchParams.toString());
      if (s) params.set('candidate', s.senator_id);
      else params.delete('candidate');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    if (!s) { setSwingYearPair(null); return; }
    trackEvent('select_candidate', {
      candidate_id: s.senator_id, candidate_name: s.senator_name, selection_source: source, year,
    });
    const senatorYears = s.years.map(Number);
    if (!senatorYears.includes(year)) {
      // Pick their most recent year, or closest to current
      const best = senatorYears.reduce((prev, cur) =>
        Math.abs(cur - year) < Math.abs(prev - year) ? cur : prev
      );
      setYear(best as ElectionYear);
    }
    // A link shared from a swing-share card carries ?yearA=&yearB= naming the exact pair that
    // card depicted — honor it so landing here reproduces what was shared, not just the
    // candidate's most recent pair (which resolveShareYearPair falls back to otherwise).
    if (source === 'url_param' && (yearAParam || yearBParam)) {
      const resolved = resolveShareYearPair(s, { yearA: yearAParam ?? undefined, yearB: yearBParam ?? undefined });
      if (resolved) { setSwingYearPair(resolved); return; }
    }
    const pairs = consecutivePairs(senatorYears);
    setSwingYearPair(pairs.length > 0 ? pairs[pairs.length - 1] : null);
  }

  function handleSwingYearPairChange(pair: YearPair) {
    trackEvent('select_swing_year_pair', { year_a: pair[0], year_b: pair[1], candidate_id: selectedSenator?.senator_id });
    setSwingYearPair(pair);
  }

  function handleYearChange(y: ElectionYear, source: 'year_selector' | 'candidate_pill' = 'year_selector') {
    if (y === year) return;
    trackEvent('select_year', { year: y, previous_year: year, source, candidate_id: selectedSenator?.senator_id });
    setYear(y);
  }

  function handleMetricChange(m: Metric) {
    if (m === metric) return;
    trackEvent('select_metric', { metric: m, previous_metric: metric, candidate_id: selectedSenator?.senator_id });
    setMetric(m);
  }

  function handleMobileTabChange(tab: MobileTab) {
    trackEvent('switch_mobile_tab', { tab_name: tab });
    setMobileTab(tab);
  }

  function handleProfileTabChange(tab: ProfileTab) {
    trackEvent('switch_profile_tab', { tab_name: tab });
    setProfileTab(tab);
  }

  // Per-candidate data, fetched on demand and cached by senator_id — replaces the old
  // "fetch every year up front" voteCache, which downloaded ~44MB before anything rendered.
  const [candidateCache, setCandidateCache] = useState<Map<string, CandidateData>>(new Map());
  // Nationwide totals cache, keyed by year — small (~2-4KB) per-year files, fetched only for
  // the years actually needed (current year, for the leaderboard; selected candidate's run
  // years, for the trend chart's national-share denominator).
  const [nationalCache, setNationalCache] = useState<Map<number, NationalYearData>>(new Map());
  const [municipalityNames, setMunicipalityNames] = useState<MunicipalityNames | null>(null);
  const [loading, setLoading] = useState(false);

  // Load candidate index once, then select whichever candidate ?candidate= names (e.g. a link
  // from a candidate's static profile or a shared swing card), falling back to Bong Go by default.
  useEffect(() => {
    loadCandidateIndex().then(idx => {
      const list = buildSenatorList(idx);
      setSenators(list);
      const fromParam = candidateParam ? list.find(s => s.senator_id === candidateParam) : undefined;
      const defaultSenator = fromParam ?? list.find(s => s.senator_id === 'go_bong');
      if (defaultSenator) {
        setYear(2025);
        // Routed through handleSelectSenator (not a bare setSelectedSenator) so the
        // default candidate gets the same side effects as any other selection —
        // notably computing swingYearPair, which otherwise stayed null until the
        // user picked a different candidate and the map/swing charts never
        // rendered on first load.
        handleSelectSenator(defaultSenator, fromParam ? 'url_param' : 'search');
      }
    });
  // Mount-only: intentionally omitting handleSelectSenator (redefined every render) to avoid
  // re-running this fetch-and-default-select on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Municipality names (candidate-independent, needed by the map regardless of selection) —
  // small file, load once on mount.
  useEffect(() => {
    loadMunicipalityNames().then(setMunicipalityNames);
  }, []);

  // Fetch the selected candidate's data file once, on selection — replaces the old eager
  // all-years preload. A candidate's file already covers every year they ran, so this is the
  // only per-candidate fetch needed regardless of how many years are involved.
  useEffect(() => {
    if (!selectedSenator) return;
    if (candidateCache.has(selectedSenator.senator_id)) return;
    setLoading(true);
    loadCandidateData(selectedSenator.senator_id)
      .then(data => {
        setCandidateCache(prev => new Map(prev).set(selectedSenator.senator_id, data));
      })
      .finally(() => setLoading(false));
  }, [selectedSenator, candidateCache]);

  // Fetch national totals for the currently selected year (leaderboard) and for every year the
  // selected candidate ran (trend chart's national-share denominator) — small files, cached by
  // year so switching years/candidates doesn't refetch what's already loaded.
  useEffect(() => {
    const neededYears = new Set<number>([year, ...(selectedSenator?.years ?? [])]);
    const missing = Array.from(neededYears).filter(y => !nationalCache.has(y));
    if (missing.length === 0) return;
    Promise.all(missing.map(y => loadNationalYear(y).then(data => [y, data] as const)))
      .then(pairs => {
        setNationalCache(prev => {
          const next = new Map(prev);
          for (const [y, data] of pairs) next.set(y, data);
          return next;
        });
      });
  }, [year, selectedSenator, nationalCache]);

  const currentCandidateData = selectedSenator ? candidateCache.get(selectedSenator.senator_id) ?? null : null;
  const currentNationalData = nationalCache.get(year) ?? null;

  const topMunis = currentCandidateData
    ? candidateTopMunicipalities(currentCandidateData, year, 7)
    : [];

  const topProvs = currentCandidateData
    ? candidateTopProvinces(currentCandidateData, year, 7)
    : [];

  // Nationwide total votes cast per year, for the years the selected candidate ran — the
  // denominator trendData/provinceShareTrend need for national vote-share figures.
  const nationalTotalsByYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const y of selectedSenator?.years ?? []) {
      const nd = nationalCache.get(y);
      if (nd) map.set(y, nationalTotalVotes(nd));
    }
    return map;
  }, [selectedSenator, nationalCache]);

  const trend = currentCandidateData
    ? candidateTrendData(currentCandidateData, nationalTotalsByYear)
    : [];

  const didRunSelectedYear = !!(currentNationalData && selectedSenator && currentNationalData[selectedSenator.senator_id]);

  // Reduce the selected candidate's data down to just their province-level numbers before
  // handing off to SwingSection, same shape the static senator page precomputes server-side —
  // see that page's comment for why SwingSection never takes the raw candidate data directly.
  // Gated on just currentCandidateData existing (one file) rather than the old "every year
  // loaded" guard, so this renders as soon as the candidate's own data arrives.
  const swingProps = useMemo(() => {
    if (!selectedSenator || !currentCandidateData) return null;
    const latestYear = Math.max(...selectedSenator.years);
    const allProvinces = candidateProvinceList(currentCandidateData, latestYear);
    const provinceTrends = allProvinces.map(adm2_en => ({
      adm2_en,
      trend: candidateProvinceShareTrend(currentCandidateData, nationalTotalsByYear, adm2_en),
    }));
    const topProvinceNames = candidateTopProvinces(currentCandidateData, latestYear, 4).map(p => p.adm2_en);
    const [yearA, yearB] = swingYearPair ?? [undefined, undefined];
    const provinceRows = (yearA !== undefined && yearB !== undefined)
      ? candidateProvinceSwing(currentCandidateData, yearA, yearB)
      : [];
    const muniRowsByProvince: Record<string, ReturnType<typeof candidateMunicipalitySwing>> = {};
    if (yearA !== undefined && yearB !== undefined) {
      for (const adm2_en of allProvinces) {
        muniRowsByProvince[adm2_en] = candidateMunicipalitySwing(currentCandidateData, yearA, yearB, adm2_en);
      }
    }
    return { provinceTrends, topProvinceNames, provinceRows, muniRowsByProvince };
  }, [selectedSenator, currentCandidateData, nationalTotalsByYear, swingYearPair]);

  // Track "did not run this year" as a friction event — fires once per candidate+year
  // combo that lands in this state, not on every render.
  useEffect(() => {
    if (!currentNationalData || !selectedSenator || didRunSelectedYear) return;
    trackEvent('no_data_for_candidate', { candidate_id: selectedSenator.senator_id, year });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSenator?.senator_id, year, didRunSelectedYear, !!currentNationalData]);

  // Track trend chart + top-table views once per newly selected candidate (not per render) —
  // these only mean something once real data is behind them.
  useEffect(() => {
    if (!selectedSenator || !currentCandidateData) return;
    if (selectedSenator.years.length > 1) {
      trackEvent('view_candidate_trend', { candidate_id: selectedSenator.senator_id, years_shown: selectedSenator.years.length });
    }
    trackEvent('view_top_table', { table_type: 'provinces', candidate_id: selectedSenator.senator_id, year });
    trackEvent('view_top_table', { table_type: 'municipalities', candidate_id: selectedSenator.senator_id, year });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSenator?.senator_id, !!currentCandidateData]);

  // Swing metric compares whichever consecutive pair of runs is selected via
  // swingYearPair — independent of the currently-selected single `year`.
  const swingPairs = selectedSenator ? consecutivePairs(selectedSenator.years) : [];
  const [swingYearA, swingYearB] = swingYearPair ?? [undefined, undefined];
  const swingMap = (selectedSenator && currentCandidateData && swingYearA !== undefined && swingYearB !== undefined)
    ? candidateNationwideMunicipalitySwing(currentCandidateData, swingYearA, swingYearB)
    : null;
  const swingYears: [number, number] | null = (swingYearA !== undefined && swingYearB !== undefined)
    ? [swingYearA, swingYearB]
    : null;

  // Top 3 candidates who did run this year — offered as a way out of the dead end
  // when the selected senator didn't run in `year`
  const topCandidatesThisYear = (!didRunSelectedYear && currentNationalData && selectedSenator)
    ? senators
        .filter(s => currentNationalData[s.senator_id])
        .sort((a, b) => currentNationalData[a.senator_id].national_rank - currentNationalData[b.senator_id].national_rank)
        .slice(0, 3)
    : [];

  const profilePanel = (
    <div className="p-4 space-y-4 md:space-y-6">
      <SearchSelect
        senators={senators}
        value={selectedSenator}
        onChange={handleSelectSenator}
      />

      {selectedSenator ? (
        <>
          <div className="sticky top-0 z-20 bg-background -mx-4 px-4 pt-2 pb-2">
            <CandidateHeader senator={selectedSenator} national={currentNationalData?.[selectedSenator.senator_id] ?? null} />
          </div>

          <CandidateCard
            senator={selectedSenator}
            national={currentNationalData?.[selectedSenator.senator_id] ?? null}
            year={year}
            onSelectYear={y => handleYearChange(y, 'candidate_pill')}
          />

          {/* Stacked directly under the header's sticky block (no gap in between) so the
              two sticky regions form one continuous opaque strip as the page scrolls —
              a gap here would let scrolled-past content peek through between them. */}
          <div className="sticky top-13 md:top-16 z-10 bg-background -mx-4 px-4 pt-0 pb-2 -mt-1">
            <div className="flex items-center gap-3 flex-wrap">
              {didRunSelectedYear && (
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit shrink-0">
                  <button
                    onClick={() => handleProfileTabChange('swing')}
                    className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
                      profileTab === 'swing'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Swing
                  </button>
                  <button
                    onClick={() => handleProfileTabChange('trends')}
                    className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${
                      profileTab === 'trends'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    National Trends
                  </button>
                </div>
              )}
            </div>

            {didRunSelectedYear && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  {profileTab === 'swing' ? (
                    <>
                      <span className="text-xs text-muted-foreground font-medium shrink-0">Comparing</span>
                      <SwingYearPairSelector
                        pairs={swingPairs}
                        value={swingYearPair}
                        onChange={handleSwingYearPairChange}
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground font-medium shrink-0">Years Ran</span>
                      <YearSelector
                        value={year}
                        onChange={y => handleYearChange(y, 'candidate_pill')}
                        availableYears={selectedSenator.years}
                        filterToAvailable
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              handleMetricChange(profileTab === 'swing' ? 'swing' : 'rank');
              handleMobileTabChange('map');
            }}
            className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent transition-colors md:hidden"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium leading-snug">
              {profileTab === 'swing'
                ? `See swing votes per municipality for ${selectedSenator.senator_name}`
                : `See rank of votes per municipality for ${selectedSenator.senator_name}`}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {didRunSelectedYear ? (
            <>
              {profileTab === 'swing' && swingProps && (
                <SwingSection
                  senator={selectedSenator}
                  provinceTrends={swingProps.provinceTrends}
                  topProvinceNames={swingProps.topProvinceNames}
                  provinceRows={swingProps.provinceRows}
                  muniRowsByProvince={swingProps.muniRowsByProvince}
                  yearPair={swingYearPair}
                  onSwitchToTrends={() => {
                    handleProfileTabChange('trends');
                    handleMetricChange('rank');
                  }}
                />
              )}

              {/* Vote share trend, Top provinces, and Top municipalities all live under the
                  National Trends tab — they're separate from the Swing tab's own province/
                  municipality breakdowns, so both shouldn't be visible at once. */}
              {profileTab === 'trends' && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
                      National vote trends
                    </p>
                    {selectedSenator.years.length > 1 ? (
                      <>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          Vote share earned nationwide in each election this candidate ran in.
                          Shows whether their overall support grew or shrank over time.
                        </p>
                        <TrendChart data={trend} />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Needs at least two runs to show a trend — this candidate has only run once.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      The provinces where this candidate earned their highest vote share in {year},
                      ranked against every other candidate in the same province.
                    </p>
                    {currentCandidateData ? (
                      <TopProvincesTable rows={topProvs} metric={metric} year={year} />
                    ) : (
                      <p className="text-muted-foreground text-sm">Loading…</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      The individual towns and cities where this candidate performed best in {year},
                      down to the municipality level.
                    </p>
                    {currentCandidateData ? (
                      <TopMunicipalitiesTable rows={topMunis} metric={metric} year={year} />
                    ) : (
                      <p className="text-muted-foreground text-sm">Loading…</p>
                    )}
                  </div>
                </>
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
                      onClick={() => handleSelectSenator(s, 'suggestion_chip')}
                      className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                    >
                      #{currentNationalData![s.senator_id].national_rank} {s.senator_name}
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
      {selectedSenator && metric === 'swing' && swingPairs.length > 0 && (
        <div className="shrink-0 border-b px-4 py-2 overflow-x-auto">
          <SwingYearPairSelector pairs={swingPairs} value={swingYearPair} onChange={handleSwingYearPairChange} />
        </div>
      )}
      {selectedSenator && metric !== 'swing' && selectedSenator.years.length > 1 && (
        <div className="shrink-0 border-b px-4 py-2 overflow-x-auto">
          <YearSelector
            value={year}
            onChange={y => handleYearChange(y, 'candidate_pill')}
            availableYears={selectedSenator.years}
            filterToAvailable
          />
        </div>
      )}
      <div className="shrink-0 px-4 py-2 flex items-center gap-3 bg-white border-b border-zinc-200">
        <span className="text-xs text-zinc-500 font-medium shrink-0">View By</span>
        <MetricToggle value={metric} onChange={handleMetricChange} />
        {metric === 'swing' && swingYears && selectedSenator && (
          <Link
            href={`/senator/${selectedSenator.senator_id}/share/map?yearA=${swingYears[0]}&yearB=${swingYears[1]}`}
            title="Share this swing map"
            aria-label="Share this swing map"
            className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all shrink-0 ml-auto"
          >
            <Share2 className="w-3 h-3" />
            Share
          </Link>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <ChoroplethMap
          candidate={currentCandidateData}
          municipalityNames={municipalityNames ?? {}}
          senatorId={selectedSenator?.senator_id ?? null}
          senatorName={selectedSenator?.senator_name ?? null}
          year={year}
          metric={metric}
          swingMap={swingMap}
          swingYears={swingYears}
          onNavigateToProfile={() => handleMobileTabChange('profile')}
          onChangeMetric={handleMetricChange}
        />
      </div>
    </div>
  );

  // Leaderboard: year selector pinned at top; tapping a candidate row navigates to Profile.
  const mobileLeaderboardPanel = (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2">
        <YearSelector value={year} onChange={handleYearChange} />
      </div>
      <div className="flex-1 overflow-hidden">
        {currentNationalData ? (
          <LeaderboardTable
            nationalData={currentNationalData}
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
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Vote className="w-6 h-6 text-primary shrink-0" strokeWidth={2} />
          <div>
            <h1 className="text-base font-semibold leading-tight">
              BotoSenado
            </h1>
            <p className="text-xs text-muted-foreground">Philippine Senate Election Results (2007 - 2025)</p>
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
          <YearSelector value={year} onChange={handleYearChange} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: leaderboard */}
          <section className="w-96 shrink-0 border-r flex flex-col overflow-hidden">
            {currentNationalData ? (
              <LeaderboardTable
                nationalData={currentNationalData}
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
            <div className="shrink-0 px-4 py-2 flex items-center gap-3 bg-white border-b border-zinc-200">
              <span className="text-xs text-zinc-500 font-medium shrink-0">View By</span>
              <MetricToggle value={metric} onChange={handleMetricChange} />
              {metric === 'swing' && swingYears && (
                <>
                  <span className="text-xs text-zinc-500 ml-auto">
                    {/* Comparing {swingYears[0]} → {swingYears[1]} — Election Years selector doesn&rsquo;t apply */}
                  </span>
                  {selectedSenator && (
                    <Link
                      href={`/senator/${selectedSenator.senator_id}/share/map?yearA=${swingYears[0]}&yearB=${swingYears[1]}`}
                      title="Share this swing map"
                      aria-label="Share this swing map"
                      className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all shrink-0"
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </Link>
                  )}
                </>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ChoroplethMap
                candidate={currentCandidateData}
                municipalityNames={municipalityNames ?? {}}
                senatorId={selectedSenator?.senator_id ?? null}
                senatorName={selectedSenator?.senator_name ?? null}
                year={year}
                metric={metric}
                swingMap={swingMap}
                swingYears={swingYears}
                onChangeMetric={handleMetricChange}
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
            onClick={() => handleMobileTabChange('leaderboard')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 10h18M3 14h18M10 4v16M14 4v16M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
            </svg>
            Leaderboard
          </button>

          <button
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'profile' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleMobileTabChange('profile')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
            </svg>
            Profile
          </button>

          <button
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${mobileTab === 'map' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => handleMobileTabChange('map')}
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
