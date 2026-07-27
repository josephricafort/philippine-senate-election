# GA4 Tracking Plan — Philippine Senate Election Explorer

## 1. App & business context

**What it is**: A client-rendered explorer of Philippine Senate election results (2007–2025, 267 candidates, ~1,635 municipalities). Three lenses: by candidate, by year, by geography (choropleth map). No monetization; the implicit business goals are **reach, trust/credibility of the data, and depth of engagement** — signals that justify continued investment (e.g. finishing the stubbed `/senator/[slug]` pages and `CompareView`).

**Structural facts that shape the tracking design**:
- App Router, 3 real routes (`/`, `/about`, `/methodology`) + 1 stub (`/senator/[slug]`, not yet implemented).
- All interaction on `/` (candidate/year/metric selection, map pan/zoom) is client-side React state — **the URL never changes**. GA4's automatic page_view-on-navigation is useless for capturing this; it must be modeled as one page_view plus custom events, as agreed.
- ~45MB of JSON fetched client-side on load, no SSR of data — load performance is a real risk to measure.
- No existing analytics of any kind.

## 2. Business questions this plan should answer

1. Are people finding this site, and from where (search, social, direct, referral from news/civic orgs)?
2. Once here, do they actually explore data, or bounce before the app becomes interactive?
3. Which lens do people use most — candidate lookup, year leaderboard, or the map? This should drive which feature gets investment next.
4. Which candidates/years/regions get the most attention? (Useful editorially — e.g. spikes around election anniversaries or news cycles.)
5. Do people read `/methodology` before or after exploring data — i.e., do they trust the numbers, or are they questioning them?
6. Where do people give up (rage-clicks, dead stubs like `/senator/[slug]`, slow map load, empty search results)?
7. Do people return, and does returning correlate with going deeper (e.g. viewing multiple candidates/years)?

## 3. Setup

- Use `@next/third-parties`'s `<GoogleAnalytics gaId="G-XXXXXXX" />` in `src/app/layout.tsx`, so it wraps every route including future ones.
- Store the measurement ID as `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.local` / `.env.example` (alongside the existing `NEXT_PUBLIC_MAP_STYLE_URL` pattern already used in this repo), not hardcoded.
- Because `/about` and `/methodology` are real server-rendered routes, their navigations *do* produce standard automatic page_views — no extra work needed there. Only `/` needs manual event modeling.
- Gate GA loading behind consent (see §6) before firing anything.

## 4. Event taxonomy

Naming convention: `snake_case`, verb_object, consistent with GA4's own recommended events where one exists.

### 4.1 Core exploration events (the heart of the plan)

| Event | Fires when | Key parameters |
|---|---|---|
| `select_candidate` | User picks a candidate via `SearchSelect` or by clicking a leaderboard row | `candidate_id`, `candidate_name`, `selection_source` (`search` \| `leaderboard_row` \| `year_pill`), `year` (currently selected year at time of pick) |
| `select_year` | User clicks a year button in `YearSelector`, or a `CandidateYearPills` pill | `year`, `source` (`year_selector` \| `candidate_pill`), `candidate_id` (if one is selected) |
| `select_metric` | User toggles Rank / Vote share / Raw votes in `MetricToggle` | `metric` (`rank` \| `vote_share` \| `raw_votes`), `previous_metric` |
| `search_candidate` | User types in the `SearchSelect` combobox (debounced — see §5) | `query_length`, `result_count` |
| `search_no_results` | Search query returns zero matches | `query_length` |
| `view_candidate_trend` | `TrendChart` actually renders (i.e. candidate ran 2+ times, chart is shown) | `candidate_id`, `years_shown` (count) |
| `map_interact` | First pan/zoom/drag on `ChoroplethMap` per candidate+year view (throttled — see §5) | `interaction_type` (`pan` \| `zoom` \| `drag`), `candidate_id`, `year` |
| `map_hover_municipality` | Hover tooltip shown on a municipality (throttled/sampled — see §5) | `has_data` (bool — hatched vs. real), `metric` |
| `map_reset_view` | "Reset view" button clicked | — |
| `view_top_table` | `TopMunicipalitiesTable` or `TopProvincesTable` renders with data for a newly selected candidate | `table_type` (`municipalities` \| `provinces`), `candidate_id`, `year` |
| `switch_mobile_tab` | Mobile tab switches (e.g. to Profile after a leaderboard row click) | `tab_name` |

### 4.2 Data-trust / informational events

| Event | Fires when | Key parameters |
|---|---|---|
| `view_methodology` | Automatic `page_view` on `/methodology` — no custom event needed, but tag as a **conversion/key event** in GA4 admin | — |
| `view_about` | Automatic `page_view` on `/about` — same, tag as key event | — |
| `click_info_menu` | User opens the mobile `InfoMenu` popover or clicks an about/methodology link | `link_target` |
| `no_data_for_candidate` | `CandidateCard` shows "Did not run in {year}" state | `candidate_id`, `year` |

### 4.3 Failure / friction events

| Event | Fires when | Key parameters |
|---|---|---|
| `dead_route_hit` | User lands on `/senator/[slug]` (currently a stub) | `slug` |
| `data_fetch_error` | Any `loadVotes`/`loadCandidateIndex`/topojson fetch fails or times out | `resource` (`votes_{year}` \| `candidate_index` \| `municipalities_geo`), `error_type` |
| `slow_initial_load` | Time from navigation start to app-interactive exceeds a threshold (e.g. 5s) — pair with Web Vitals, see §5 | `load_time_ms`, `connection_type` (from `navigator.connection.effectiveType` if available) |

### 4.4 Standard GA4 recommended events to keep (automatic/enhanced measurement)

Enable **GA4 Enhanced Measurement** for: `scroll` (90% depth — useful on `/about`/`/methodology` to see if people actually read the disclaimer), `outbound_click`, `file_download` (irrelevant here unless data exports are added later), `session_start`, `first_visit`. No manual work needed — just leave Enhanced Measurement on when creating the GA4 property.

## 5. Implementation notes (things easy to get wrong)

- **Throttle map events.** `mousemove`-driven hover events fire constantly; naively wiring `map_hover_municipality` to every mousemove will flood GA4 and blow through the free-tier event volume. Debounce/sample (e.g. only fire once per municipality per 2s, or sample 1-in-N).
- **Throttle/debounce search events.** Fire `search_candidate` on debounced input (e.g. 400ms after typing stops), not per keystroke.
- **De-dupe `select_candidate`/`select_year`** if the same value is re-selected (e.g. clicking the already-active year) — don't fire redundant events.
- **`map_interact` should be "first interaction per view," not every pixel of pan** — otherwise it's unusable for funnel analysis. Reset the "has interacted" flag when candidate or year changes.
- **`dead_route_hit`** matters right now because `/senator/[slug]` is a stub — if this fires meaningfully, it's a signal to prioritize building it (someone is already linking to or guessing these URLs).
- **Custom dimensions to register in GA4 admin**: `candidate_id`, `candidate_name`, `year`, `metric`, `selection_source` — without registering these as custom dimensions, they'll be stuck in event params and unusable in standard reports/explorations.
- **Mark key events** in GA4 admin: `view_methodology`, `select_candidate`, `map_interact` (first one per session) — these represent real engagement/trust signals worth tracking as conversions even without monetization.
- **Performance timing**: use `web-vitals` package (or Next.js's built-in `useReportWebVitals`) to send LCP/INP/CLS to GA4 as events — directly relevant given the 45MB payload risk identified earlier.

## 6. Consent considerations

Given this is a public civic-data site that could draw international interest (researchers, journalists, diaspora Filipinos abroad, including EU-based users):

- Implement **Google Consent Mode v2** at minimum: default `analytics_storage` and `ad_storage` (ad_storage isn't used here, but Google increasingly expects both) to `denied` until consent is given, then `update` on acceptance. `@next/third-parties`'s `GoogleAnalytics` component loads gtag.js, so Consent Mode should be initialized *before* that component mounts (a small inline script in `layout.tsx` calling `gtag('consent', 'default', ...)`).
- A simple, non-intrusive banner is enough for a low-risk analytics-only (no ads, no PII collection) site — don't over-engineer a full CMP unless traffic data later shows meaningful EU/UK traffic.
- Do not collect or pass PII in event params — nothing in this app's data model requires it (candidate names are public figures/officials, not user PII), so this is a low-risk area, but worth stating explicitly since `candidate_name` is a free-text-adjacent param.
- IP anonymization is default/automatic in GA4 (unlike old Universal Analytics) — no extra config needed.
- Document the consent choice in `/methodology` or a small privacy note, consistent with the site's existing transparency-first tone (it already explains data limitations in detail).

## 7. Suggested GA4 Explorations to build after data starts flowing

- **Funnel**: `first_visit` → `select_candidate` → `map_interact` OR `view_top_table` → return visit. Shows how many people go from landing to genuine exploration.
- **Path exploration** from `session_start`: do people go year-first or candidate-first? Answers business question #3.
- **Free-form table**: `candidate_name` × event count, to surface most-explored candidates — editorially useful and a good "what's trending" signal.
- **Segment overlap**: users who hit `view_methodology` vs. those who don't — do methodology-readers engage more deeply (proxy for trust correlating with engagement)?

## 8. Rollout order

1. Base GA4 property + `@next/third-parties` install + consent gating (§3, §6) — ship this alone first, validate page_views on `/about`/`/methodology` and basic `/` load in GA4 DebugView.
2. Core exploration events (§4.1) — the highest-value, most business-relevant data.
3. Trust/informational events (§4.2) + key event marking.
4. Failure/friction events (§4.3) + Web Vitals — these matter most once there's real traffic to diagnose.
5. Custom dimensions + Explorations (§5, §7) in GA4 admin once events are flowing and validated in DebugView.
