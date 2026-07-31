# Metric definitions and data lineage

This document explains every derived number shown on the site — vote share, rank,
vote-share swing, and the smaller metrics built on top of them — with the exact
formula, source file, and how each one feeds the next. It is the **technical**
counterpart to the "What the numbers on this site mean" section of
[`/methodology`](../src/app/methodology/page.tsx), which explains the same
concepts in plain language for a general audience. This document is for anyone
reading or modifying the source: it names the exact functions, files, and line
numbers so a claim here can be checked against the code directly.

`/methodology` also covers how the raw per-year source files were cleaned,
standardized, and combined; this document starts where that page's data-cleaning
steps end, once clean per-candidate vote counts exist.

## How the pieces connect

```
raw votes (per candidate, per municipality, per year)
        │
        ├──► vote_share (municipality)  ──► rank (municipality)
        │
        ├──► vote_share (province)      ──► rank (province)      ──► province index ("1.4x national")
        │
        └──► national_votes             ──► national_rank
                     │
                     ▼
        vote-share swing (a candidate's own share, year A vs year B, at any of the levels above)
                     │
                     ├──► swing color (map/bar shading)
                     ├──► swing headline ("gained support in N out of TOTAL (%)")
                     └──► quartile sample (which rows a bar chart actually shows)
```

Two pipelines produce the base numbers (`vote_share`, `rank`, `national_votes`,
`national_rank`) and write them into the static JSON in `public/data/`. Everything
below that — swing, index, headline direction, color buckets, sampling — is
**never stored**; it's computed at request time in `src/lib/data.ts` and
`src/lib/swing.ts` from those static fields.

---

## 1. Vote share

**Definition:** a candidate's share of the two-way-comparable pool of votes at a
given geographic level (municipality, province, or national), for a single
election year.

**Formula:** `candidate's votes ÷ sum of all senatorial candidates' votes in that
same geography and year`.

- Not a share of registered voters, ballots cast, or valid votes — those figures
  (`sum_of_registered_voters`, `sum_of_valid_ballot`, `margin`, etc.) are present
  in some source files but are explicitly dropped as "junk" before any
  computation happens
  (`ph-national-election-municipal-level-data/scripts/process.R:23-42`). There is
  no turnout metric anywhere in this dataset.
- Denominator = every senatorial candidate on the ballot that year in that
  geography, so vote share always sums to (approximately) 100% across candidates
  within one municipality/province/year.

**Source of truth (pipeline, R):**
`ph-national-election-municipal-level-data/scripts/slim.R`

```r
# Municipality level (slim.R:204-217)
muni_totals <- all_votes_long %>% group_by(election_year, adm3_psgc) %>%
  summarize(muni_total = sum(votes, na.rm = TRUE), .groups = "drop")
all_votes_long <- all_votes_long %>% left_join(muni_totals, ...) %>%
  mutate(vote_share = round(votes / muni_total, 6), ...)

# Province level (slim.R:225-236) — same formula, one level up
prov_vote_share = round(prov_votes / prov_total, 6)
```

There is no national `vote_share` field — national figures are stored as raw
vote counts (`national_votes`) only.

**Output fields:** `vote_share` (municipality, 0–1, 6 decimal places) and
`prov_vote_share` → written to JSON as `vote_share` on the province object too —
see [§6 field reference](#6-field-reference).

**Second implementation (Node, `scripts/prepare-data.ts:248`)** regenerates
municipality-level `vote_share` independently from the same wide CSV, as a
narrower alternate pipeline. Same formula (`votesMap[sid] / (munTotal || 1)`),
but it is a **separate code path** from the R pipeline above — the two aren't
guaranteed to produce byte-identical output, though they should agree in
practice since they read the same underlying vote counts.

**Client-side recomputation:** several chart helpers in `src/lib/data.ts`
recompute vote share on the fly from raw `votes` fields, for combinations not
pre-baked into `candidates/*.json` — e.g. a candidate's national trend across all
years (`trendData`, `data.ts:157-174`), or their share within one specific
province across years (`provinceShareTrend`, `data.ts:187-216`). These always use
the identical numerator/denominator convention as the pipeline.

---

## 2. Rank

**Definition:** a candidate's standing among all candidates at a given geography
and year, ordered by **raw vote count** (not vote share).

**Tie handling:** `ties.method = "min"` (standard competition ranking) — tied
candidates share the lower rank number, and the next distinct rank skips ahead
accordingly (e.g. two candidates tied for 3rd both show rank 3; the next
candidate is rank 5, not 4).

**Formula, per level** (`slim.R`):

```r
# National (slim.R:196-200)
national_tallies <- all_votes_long %>% group_by(election_year, senator_id) %>%
  summarize(national_votes = sum(votes, na.rm = TRUE), .groups = "drop") %>%
  group_by(election_year) %>%
  mutate(national_rank = rank(-national_votes, ties.method = "min"))

# Municipality (slim.R:210-216) and province (slim.R:236-241) use the same
# rank(-votes, ties.method = "min") pattern, grouped by (year, municipality)
# or (year, province) respectively instead of (year) alone.
```

Rank is **always computed on raw votes, never on vote share** — a candidate can
have a higher vote share than another in a small municipality while still being
outranked nationally, and vice versa.

**Where it's precomputed vs. recomputed:** rank is baked into JSON at all three
levels (`muni_rank`/`rank`, `prov_rank`/`rank`, `national_rank`) by the R
pipeline; the frontend only sorts by these values, e.g.
`LeaderboardTable.tsx:37` (`national.national_rank` ascending). The Node
pipeline (`prepare-data.ts:241,249`) recomputes municipality rank too, but by
plain array-index after sorting — ties get sequential ranks there, not
`min`-style — so it is not guaranteed identical to the R path on tied
municipalities.

**Known caveat, shown in-app:** `RankDisclaimerTooltip`
(`src/components/InfoTooltip.tsx:10-30`) appears next to every rank shown in the
UI: "May deviate from Comelec's official rank/count," linking to
`/methodology#disclaimer`. This follows directly from vote share's own caveat —
missing municipalities in the source data remove votes from every downstream
total, so a rank computed here can differ from COMELEC's official rank.

---

## 3. Vote-share swing

**Definition:** the **percentage-point change in a candidate's own vote share**
between two of their election runs, at a chosen geography (nationwide,
one province, one municipality, or every municipality on the map at once).

**This is not a fixed year-over-year comparison against 2022 or any other single
baseline.** "Previous" means whichever earlier run the comparison is anchored
to — by default, a candidate's two most recent *consecutive* runs, generated by
`consecutivePairs()` (`src/lib/swing.ts:208-213`):

```ts
// e.g. Pangilinan ran 2007, 2016, 2025 → pairs are [2007,2016] and [2016,2025]
// 2010, 2013, 2019, 2022 are never pair endpoints for him — he wasn't on the
// ballot those years, so there's no "vote share" to diff against.
for (let i = 0; i < sorted.length - 1; i++) pairs.push([sorted[i], sorted[i + 1]]);
```

The UI's `SwingYearPairSelector` lets a user pick a different pair from the
candidate's own run history; `resolveShareYearPair()` (`src/lib/data.ts:366-378`)
resolves which pair a shared link should reproduce.

**Formula (repeated per geography level, `src/lib/data.ts`):**

```ts
const shareA = candidateVotes / totalVotes;  // year A, at chosen geography
const shareB = candidateVotes / totalVotes;  // year B, same geography
const delta  = Math.round((shareB - shareA) * 10000) / 10000;  // rounded to 0.01pt
```

Same pattern at three levels:
- `nationwideMunicipalitySwing` (`data.ts:293-319`) — every municipality nationally, keyed by PSGC code, powers the choropleth map's "Swing" mode.
- `provinceSwing` (`data.ts:221-256`) — every province, for province bar charts.
- `municipalitySwing` (`data.ts:260-288`) — every municipality within one selected province.

**Units:** the raw `delta` is a fraction (e.g. `0.0125`), but it is always
displayed as **percentage points**, via `formatSwingPt()`
(`src/lib/swing.ts:183-186`): `±(delta × 100).toFixed(1) + "pt"`, e.g. `"+1.3pt"`.
A swing from 20% to 21.3% share reads as `+1.3pt` — not `+6.5%` (relative change)
and not `+1.3%` (which would be ambiguous with a relative reading).

**Candidates with only one run have no swing** — `SwingSection.tsx:76-99` shows
an explanatory message ("Vote-share swing is only available for candidates who
ran in 2 or more elections") instead of a chart.

### "Flat" — the zero-swing threshold

A delta counts as **flat**, not a gain or loss, if it would display as `0.0pt` at
the precision actually shown to the user:

```ts
// src/lib/swing.ts:18-20
export function swingRoundsToZero(delta: number, scale: number = 100): boolean {
  return Math.abs(delta * scale).toFixed(1) === '0.0';
}
```

This is deliberate: an earlier version counted any `delta >= 0` as a "gain," so a
candidate whose numbers were essentially unchanged (float-noise-level deltas)
could be reported as having "gained support in 953 out of 1,623 (59%)"
municipalities — a real observed bug, fixed by carving out an explicit `flat`
bucket. This single function is the source of truth for "is this effectively
zero," shared by the headline text, the map/bar coloring, and the sign-suffix
logic — they can never disagree about which deltas count as flat.

### Province index (a second, related metric — not the same as swing)

Shown on the province trend chart as e.g. "1.4x national," this is a *different*
number from vote-share swing, though built from the same underlying shares:

```ts
// ProvinceSwingChart.tsx:20-21
// index = that year's province vote share ÷ that year's national vote share
function toIndex(p: Point): number | undefined {
  return p.national_share > 0 ? p.vote_share / p.national_share : undefined;
}
```

- `1.0` = the candidate performs in that province exactly at their national
  average that year.
- `>1.0` = overperformance (a stronghold); `<1.0` = underperformance.
- The chart's own "swing" pill is the **index's own first-to-last delta**
  (`ProvinceSwingChart.tsx:32`), not a vote-share-point delta — it's unitless
  ("x"), not "pt". This exists because raw province vote share often tracks the
  national trend closely enough that a province-share chart looks like a
  near-duplicate of the national chart; expressing it relative to that
  candidate's own national average that year isolates what's distinctive about
  the province.

---

## 4. Swing color, headline, and sampling

These three all consume the `delta` values from §3 — none of them are stored;
all are computed at render/share-image time.

### Color

- **Binary (gain/loss/flat), used for trend lines:** `swingColor()`
  (`swing.ts:30-33`) — green `#4ade80` if `delta > 0`, red `#f87171` if
  `delta < 0`, gray `#a1a1aa` if flat (§3).
- **10-bucket (5 shades of loss + 5 of gain), used for the choropleth map and
  bar charts:** `swingBucketColor()` (`swing.ts:156-167`). Buckets are
  **equal-width**, scaled against the single largest absolute delta across *all*
  municipalities in the current view (`swingMaxAbs`, `swing.ts:128-132`) — both
  the loss side and the gain side share that same scale, so a given shade means
  the same swing magnitude regardless of direction. An exact-zero swing gets its
  own neutral gray (`#d4d4d8`), distinct from the lightest gain shade, so "no
  measured change" never visually reads as "a small gain."
- The live interactive map and the static share-card image reuse this exact
  same function and color tables, so a shared image can never show different
  colors than what the user actually saw on the map.

### Headline ("X gained support in N out of TOTAL (Y%) municipalities...")

`buildSwingHeadline()` (`swing.ts:50-109`) buckets every row (municipality or
province) into gain / loss / flat using the same `swingRoundsToZero` check, then
derives one of four `direction`s:

| direction | condition |
|---|---|
| `flat` | flat rows are >50% of all rows — takes priority over everything else |
| `loss` | among rows that *did* move, losses are >50% |
| `gain` | among rows that *did* move, gains are ≥50% (not a majority loss) |
| `mixed` | neither gain nor loss reaches a majority among moved rows |

The count/percentage in the headline (e.g. "111 out of 113 provinces") is always
measured against the **full dataset**, not the handful of sample rows a bar
chart displays — see `provinceSwingHeadline()`'s comment at `data.ts:354-360`,
which explicitly notes this mirrors how outlets like the NYT/AP report
county-level election swing (a real count over the full set, not an
extrapolation from a sample).

There is deliberately **no minimum vote-share cutoff** for inclusion — an
earlier version excluded any province where a candidate polled under 3% in both
years, which shrank the denominator (e.g. 117 real provinces down to 64) without
disclosing it, making the claim look more sweeping than it was
(`data.ts:387-393`).

### Quartile sampling (which rows a bar chart actually shows)

`quartileSample()` (`swing.ts:219-243`) picks a fixed number of representative
rows from a delta-sorted list — "Biggest drop," evenly spaced percentiles,
"Median," and "Biggest gain" — rather than an arbitrary top-N, so a collapsed bar
chart still shows the shape of the full distribution. Used identically by the
province and municipality swing bar charts.

---

## 5. "Did not run"

Purely structural, not a computed metric: a candidate "did not run" in year Y if
there is no record for their `senator_id` in that year's data at all (no row in
`votes_wide_{year}.csv` / `national_{year}.json`).

```ts
// CandidateCard.tsx:76-78 (and mirrored in ChoroplethMap.tsx:1071-1073)
national ? /* show their result */ : "Did not run"
```

Because it's structural, "did not run" and "ran but received the geography's
vote-share denominator of effectively zero" are distinguishable in the data —
the former has no `national` entry at all for that year; the latter has an
entry with a very small `vote_share`.

---

## 6. Field reference

Exact field names as written to `public/data/` — cross-reference these against
the formulas above.

| File | Shape |
|---|---|
| `votes_{year}.json` | `{ year, municipalities: { [adm3_psgc]: { adm3_en, adm2_en, candidates: [{ senator_id, votes, vote_share, rank }] } }, national: { [senator_id]: { national_votes, national_rank } } }` |
| `candidates/{senator_id}.json` | `{ senator_id, senator_name, years: { [year]: { national_votes, national_rank, municipalities: { [adm3_psgc]: { adm3_en, adm2_en, votes, vote_share, rank } }, provinces: { [adm2_en]: { votes, vote_share, rank } } } } }` |
| `national_{year}.json` | `{ [senator_id]: { national_votes, national_rank } }` |
| `candidate_index.json` | `[{ senator_id, senator_name, years: string[] }]` |
| `municipality_names.json` | `{ [adm3_psgc]: { adm3_en, adm2_en } }` |
| `ph_municipalities.json` | topojson, `adm3_psgc` stamped on each geometry's properties |

**No field named `swing`, `margin`, `index`, or `turnout` exists in any JSON
file.** Every metric in §3 and §4 is computed at request time from `votes` /
`vote_share`, never persisted.

---

## 7. Things this dataset does *not* compute, and why

- **Turnout %** — the source columns needed (`sum_of_registered_voters`,
  `sum_of_valid_ballot`) are dropped during cleaning as non-vote data
  (`process.R:23-42`); no turnout figure is derivable from what remains.
- **Margin of victory** — same reason; source `margin` columns are dropped as
  junk before any computation.
- **Party/coalition affiliation, uncontested-seat handling, substitution
  handling** — the dataset has no party or coalition field at all, only
  `senator_id`/`senator_name` (a candidate identity resolved across name
  variants — see `/methodology` §5). Senate elections elect 12 at-large seats
  nationally with no individual "uncontested seat" concept, so this is out of
  scope by design, not an oversight.

For how the underlying vote counts themselves were cleaned, corrected, and
verified before any of the above formulas ran, see
[`/methodology`](../src/app/methodology/page.tsx) — that page is the canonical
source for provenance-level caveats (missing municipalities, HUC handling, name
resolution), which this document assumes as given.
