# Candidate photo sourcing — handoff briefing

## What this is

The app (`philippine-senate-election`) shows a leaderboard and per-candidate profile
page for every person who has run for Philippine senator, 2007–2025 (268 unique
candidates, `public/data/candidate_index.json`). Each candidate row/profile shows a
circular avatar next to their name. Originally this was always initials-on-a-colored-
circle. We're progressively replacing that with a real photo where one can be
sourced legally, falling back to initials otherwise.

**Current state: 107 of 268 candidates have a real photo. 161 do not.**

## How the system works (already built, don't rebuild this)

- `public/data/candidate_photos.json` — the manifest. Flat map of
  `senator_id -> "/images/candidates/{senator_id}.{ext}"`. This is the single
  source of truth the app reads at render time.
- `public/images/candidates/{senator_id}.{ext}` — the actual downloaded image
  files (jpg/png/gif), one per candidate who has an entry in the manifest above.
- `src/lib/candidate-photos.ts` — `getCandidatePhoto(senatorId)` reads the
  manifest, returns the path or `null`.
- `src/components/CandidateAvatar.tsx` — shared component used by both the
  leaderboard rows (`src/components/LeaderboardTable.tsx`) and the profile header
  (`src/components/CandidateCard.tsx`). Renders the photo if
  `getCandidatePhoto()` returns something, otherwise renders the original
  initials-circle fallback. **You should not need to touch this component** —
  just add entries to the manifest + files to the images folder and it picks
  them up automatically.

To add a new candidate's photo: download the image to
`public/images/candidates/{senator_id}.{ext}`, add the path to
`public/data/candidate_photos.json`, done. No code changes needed.

## Source and licensing rules (must follow — this is a public election-tracking
site, misattributed or improperly licensed photos are a real risk)

- **Repository-level provenance summary:** the production app's local avatar files are
  downloaded from Wikimedia Commons (`commons.wikimedia.org`) using Wikimedia's
  cached thumbnail infrastructure (`upload.wikimedia.org`). The actual files we keep
  locally are therefore sourced through Wikimedia, even when a Commons file page says
  the original image first appeared on an official government page, Flickr, or as an
  uploader-owned photo.
- **License buckets currently allowed in the repo:** public domain Philippine
  government works, public domain / CC0 / PD-self uploads, Creative Commons licenses
  such as CC BY and CC BY-SA, and a small number of legacy reusable Commons files
  under GFDL. If a file is not clearly reusable on its own Commons page, do not add it.
- **Only source images from Wikimedia Commons** (`commons.wikimedia.org`), or
  another source you've explicitly confirmed is public domain / Creative
  Commons licensed. Do not scrape from COMELEC, news sites, Facebook, or other
  sources without checking licensing — those are typically not reusable.
- **Verify the person, not just the name.** The Philippines has heavy political
  dynasties — many candidates share a surname (sometimes even a full first+last
  name) with a parent, sibling, or more famous relative who also has a Commons
  category. A same-name category is not proof of a correct match. Check the
  Commons category/file page's bio details (birth year, career, party) against
  the candidate before accepting a match. We caught and had to reject several
  of these:
  - `diokno_chel` (Chel Diokno) — a "Jose W. Diokno" category exists, but it's
    his **father**, a different, older senator (1922–1987). No category found
    for the son specifically.
  - `enrile_juanponce_jr` — only "Juan Ponce Enrile" exists on Commons, and
    that's the famous **father** (Sr.). No separate category for the son.
  - `guingona_teofisto_iii` (TG Guingona) — the "Teofisto Guingona Jr."
    category is his **father**, the former VP. No category for the son.
  - `tanada_lorenzo_erin_tapat` — the "Lorenzo Tañada" category is the
    **grandfather** (1898–1992). No category for this specific descendant.
  - `aquino_bam` — the app's `aquino_bam` (Bam Aquino) was initially
    fuzzy-matched to "Benigno Aquino, Jr." — wrong, that's a completely
    different relative. Bam Aquino does have his own category, but it has no
    usable solo photo (only a signature file and a two-person photo).
  - `revilla_bong` — was initially matched to "Ramon Revilla **Sr**." — wrong,
    Bong Revilla is the son and has his own separate category.
  - `kiram_jamalul` (in the 161 remaining) — a Commons file exists captioned
    "Jamalul Kiram III" but it's almost certainly the 2013 Sultan of Sulu (a
    much older, since-deceased public figure) — not necessarily the same
    person as the current-day senate candidate. **Do not use without further
    verification of the specific person.**
  - `maceda_manong_ernie` — unresolved ambiguity. The app has this as a
    separate candidate from an existing (already-photographed) `maceda`
    entry for the famous Senate President Ernesto Maceda. Unclear if
    "Manong Ernie" is meant to be the same person or a distinct one — check
    the app's own data before assuming either way.

- **Watch for active Commons licensing disputes.** As of this session (2026),
  several official "Senate portrait 2025" files (for sitting 20th Congress
  senators) were under an active Commons deletion nomination (filed ~2026-05-10)
  disputing whether they're really public domain, since the Senate of the
  Philippines website itself shows "© All rights reserved." These files were
  still live at research time but carry deletion risk. Where possible we
  substituted a different, non-disputed photo of the same person (e.g. an
  official Commission on Appointments portrait instead) — do the same if you
  run into one of these. Check the file's Commons page for an active
  "nominated for deletion" banner before using it.

## Recommended workflow (matches what worked in this session)

1. Get the candidate's Commons category page:
   `https://commons.wikimedia.org/wiki/Category:<Full Name>` — try full formal
   name first (e.g. "Franklin Drilon" not "Frank Drilon"), fall back to Commons
   search (`https://commons.wikimedia.org/w/index.php?search=<name>`) if the
   direct category 404s.
2. Verify identity (see rules above).
3. Pick a solo portrait/headshot if available over group/rally/event photos.
   Note the exact filename (Commons filenames often contain curly quotes `'`
   `"` `"` not straight ones — copy exactly, don't retype).
4. Check the license on the file's own page
   (`https://commons.wikimedia.org/wiki/File:<filename>`), not just the
   category default — files within one category can carry different licenses.
5. Resolve the actual download URL via the MediaWiki API rather than guessing
   an `upload.wikimedia.org` path:
   ```
   https://commons.wikimedia.org/w/api.php?action=query&titles=File:<filename>&prop=imageinfo&iiprop=url&format=json
   ```
6. **Respect Wikimedia's rate limits.** Direct-downloading full-resolution
   originals gets you 429'd fast. Wikimedia's API explicitly told us to use
   their standard cached thumbnail sizes instead of hotlinking full images:
   **20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840px** wide (see
   `https://www.mediawiki.org/wiki/Common_thumbnail_sizes`). We used 250px,
   which is plenty for a small avatar. Thumbnail URL pattern:
   ```
   https://upload.wikimedia.org/wikipedia/commons/thumb/<hash-path>/<width>px-<filename>
   ```
   (derive `<hash-path>` from the resolved original URL — it's the
   `/x/xy/filename` segment after `/wikipedia/commons/`).
   Pace requests at ~1.5–3 seconds apart. We hit 429s at faster paces.
7. Download, save to `public/images/candidates/{senator_id}.{ext}`, add the
   entry to `public/data/candidate_photos.json`.
8. Sanity check: run `npx tsc --noEmit` (should be silent/clean), then spot
   check a few candidates by curling the dev server
   (`curl -s http://localhost:3000/senator/{senator_id} | grep senator_id`)
   to confirm the `<img>` tag renders with the right `src`, and that
   candidates *without* an entry still correctly fall back to initials.

## What's left to do (161 candidates, sorted by priority)

Full breakdown of research already done is saved alongside this briefing in
`.photo-research-handoff/`:
- `photo_research_findings.md` — results for ~117 of the 268 candidates,
  categorized FOUND (clean), FOUND (flagged — low-res/weak ID/crowd photo),
  NOT_FOUND, or AMBIGUOUS.
- `new_candidates.json` / `new_download_results.json` — the 68 that were
  actually downloaded and merged into the manifest in the most recent pass.

**Known gaps to resume from (highest value first):**

1. **Already-found-but-never-downloaded** (from an earlier, partially-lost
   research pass — re-verify before using, don't just trust this list blindly):
   `padilla_robin` (Robinhood Padilla, rank #1), `tulfo_raffy` (Raffy Tulfo,
   rank #3), `villar_manny` (Manny Villar, rank #4) — these were confirmed
   FOUND with Public Domain Commons files in an initial research pass, but the
   findings were never fully carried through to a download. Re-check and
   download these first — likely the fastest wins.

2. **Never researched at all** — a batch of 12 candidates around rank #17-20
   (`roque_harry`, `hagedorn_ed`, `ong_willie`, `petilla_carlos_jericho`,
   `roco_sonia`, `diokno_chel`, `lapid_mark`, `mangudadatu_dong`,
   `querubin_ariel`, `salvador_phillip_ipe`, `villanueva_eddie`,
   `bosita_colonel`) — a research agent was dispatched for these but never
   returned a result before the task was interrupted.

3. **Never dispatched** — roughly 100 more candidates in the "low tier" (best
   national rank #46 and below — mostly minor/perennial candidates, expect a
   much lower hit rate here, historically ~15-40% found vs ~80% in the top
   tier). Full list of remaining senator_ids can be regenerated with:
   ```python
   import json
   candidates = json.load(open('public/data/candidate_index.json'))
   photos = json.load(open('public/data/candidate_photos.json'))
   missing = [c for c in candidates if c['senator_id'] not in photos]
   # sort by best-ever national rank using public/data/national_{year}.json
   # for year in [2007,2010,2013,2016,2019,2022,2025], see prior session's
   # approach — best_rank[sid] = min(national_rank across years present)
   ```

4. **3 candidates with unresolvable filenames** from the last pass —
   `defensor_mike`, `gadon_larry`, `mendoza_heidi`. A Commons category was
   found for each (person identity looked plausible) but the exact filename
   we recorded didn't resolve via the API — needs a fresh, careful re-check of
   the exact filename (again, watch for curly quotes / apostrophes) rather
   than reusing what's in `new_candidates.json` for these three.

## Cost/scope expectation

Researching all 268 candidates end-to-end (this session covered roughly half)
cost on the order of ~150-200K tokens for the ~117 already researched, at
roughly 3,000-6,000 tokens per candidate depending on tier (prominent
candidates are cheaper — cleaner name matches, fewer dead-end searches). The
remaining ~161 would likely run another ~800K-1M tokens if pursued
exhaustively, with a much lower hit rate in the bottom tier. Recommend
prioritizing by national rank (already how the above list is ordered) rather
than working through alphabetically, and stopping once marginal value drops
off — not every minor perennial candidate will have a discoverable, correctly-
identified, cleanly-licensed photo.
