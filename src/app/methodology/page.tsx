import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SITE_URL } from '@/lib/site';
import SiteHeader from '@/components/SiteHeader';
import MethodologyToc, { type TocGroup } from '@/components/MethodologyToc';

export const metadata: Metadata = {
  title: 'Data & Methodology — BotoSenado',
  description: 'How Senate election results from 2007–2025 were standardized, corrected, verified, and combined.',
};

const faqs = [
  {
    question: 'Is this official COMELEC data?',
    answer: 'No. This is an independent, unofficial project, not affiliated with or verified by COMELEC. The dataset was compiled municipality by municipality from individually sourced files, and results from some municipalities are missing, so rankings, tallies, and vote counts shown can diverge from official COMELEC results.',
  },
  {
    question: 'Which election years are covered?',
    answer: 'Seven Philippine senatorial election years: 2007, 2010, 2013, 2016, 2019, 2022, and 2025, each broken down to the municipality level.',
  },
  {
    question: 'Why might a candidate’s numbers here differ from other sources?',
    answer: 'Some municipalities are missing from the underlying source files. Where a municipality is missing, its votes are absent from every total, rank, and vote share computed from this dataset, including national and provincial figures, so outcomes shown can diverge from the official count.',
  },
  {
    question: 'Why do some "provinces" show up as cities, like Davao City or Cebu City?',
    answer: 'Highly Urbanized Cities (HUCs) — Davao City, Cebu City, Iloilo City, and others, plus every city in Metro Manila — are administratively independent of the province they sit in, so their voters do not take part in provincial elections. Philippine geographic data reports each HUC as its own unit rather than folding it into the province around it, so both may appear side by side here, for example "Cebu" and "Cebu City" as separate entries. On the map, Metro Manila’s cities are merged into one "Metro Manila" area; other HUCs are still shown as their own standalone shape.',
  },
  {
    question: '"Swing vs. previous election" — previous relative to what, exactly?',
    answer: 'It means that candidate’s own last time on the ballot, not a fixed year like 2022 for everyone. A candidate who ran in 2016 and 2025 but skipped 2019 and 2022 is compared 2016-to-2025, since those are their two most recent runs. You can change which pair of years is compared using the year picker above a swing chart, as long as the candidate ran in both.',
  },
  {
    question: 'Why can a candidate’s rank move without their vote share moving much, or vice versa?',
    answer: 'Rank and vote share are answering two different questions. Rank compares raw vote totals against every other candidate that year and place, so it shifts whenever the field around a candidate changes, even if their own vote share barely does — for example, a strong new candidate entering a race can push someone from rank 3 to rank 5 without that person losing a single voter. Vote share, by contrast, only looks at one candidate’s own slice of the vote, so it moves only when their own support actually changes.',
  },
  {
    question: 'Does the site show voter turnout or margin of victory?',
    answer: 'No. The source files’ registered-voter and ballot-count columns were removed early in cleaning (see "Removing non-vote data" above) because they were inconsistent and not needed for vote-share or rank calculations, so no turnout percentage or victory-margin figure is computed anywhere on the site.',
  },
];

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Philippine Senate Election Results, 2007–2025 (Municipality-level)',
  description: 'Vote counts per senatorial candidate per city or municipality across seven Philippine senatorial election years (2007, 2010, 2013, 2016, 2019, 2022, 2025), standardized, corrected, and verified from individually sourced files.',
  url: `${SITE_URL}/methodology`,
  temporalCoverage: '2007/2025',
  spatialCoverage: {
    '@type': 'Place',
    name: 'Philippines',
  },
  creator: {
    '@type': 'Organization',
    name: 'BotoSenado',
    url: SITE_URL,
  },
  isAccessibleForFree: true,
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-6">
      <h2 className="text-lg font-semibold tracking-tight">
        <span className="text-muted-foreground font-normal tabular-nums">{n}. </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

// Anchors the left-rail ToC jumps to — kept in one place so the rail and the section ids can
// never drift apart (every id here must exist exactly once as a heading's id below).
//
// Split into two groups because the page holds two different kinds of content: a numbered,
// sequential process narrative (how the dataset was built, step 0 through 8) and unnumbered
// reference material (what the numbers mean, FAQ, disclaimer) that isn't part of that sequence.
// A single flat list made the numbering look like it just stopped partway through; grouping
// makes the shift explicit, both here and via the matching "Part" headers in the page body.
const tocGroups: TocGroup[] = [
  {
    label: 'How the data was built',
    items: [
      { id: 'sec-overview', label: 'Overview' },
      { id: 'sec-source-data', label: 'Source data' },
      { id: 'sec-standardizing', label: 'Standardizing the format' },
      { id: 'sec-removing-non-vote', label: 'Removing non-vote data' },
      { id: 'sec-location-code', label: 'Correcting a missing location code' },
      { id: 'sec-name-resolution', label: 'Resolving candidate name inconsistencies' },
      { id: 'sec-verification', label: 'Verification' },
      { id: 'sec-final-structure', label: 'Final data structure' },
      { id: 'sec-status', label: 'Status' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'sec-definitions', label: 'What the numbers mean' },
      { id: 'sec-faq', label: 'Frequently asked questions' },
      { id: 'disclaimer', label: 'Disclaimer' },
    ],
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to explorer
        </Link>

        <div className="space-y-2 mt-6 mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">
            Data Processing Methodology
          </h1>
          <p className="text-sm text-muted-foreground">
            Philippine Senate election results, 2007–2025
          </p>
        </div>

        <div className="md:grid md:grid-cols-[12rem_1fr] md:gap-10">
          <aside className="hidden md:block">
            <MethodologyToc groups={tocGroups} />
          </aside>

          <div className="max-w-2xl space-y-10">

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Part 1
          </p>
          <h2 className="text-xl font-semibold tracking-tight">How the data was built</h2>
        </div>

        <Section id="sec-overview" n={0} title="Overview">
          <p>
            This dataset combines Senate election results from seven election years (2007,
            2010, 2013, 2016, 2019, 2022, 2025) into a single, consistent dataset showing vote
            counts per candidate per city or municipality. Each year&apos;s source file was
            released in a different format. The steps below describe how these were
            standardized, corrected, verified, and combined.
          </p>
        </Section>

        <Section id="sec-source-data" n={1} title="Source data">
          <p>
            Seven files, one per election year, obtained as Excel or CSV spreadsheets. Each
            file lists municipalities in rows and candidates in columns, with vote counts in
            the cells. Formats differed by year: column names, file type, number of extra
            columns, and how missing or special entries were recorded were not consistent
            across files.
          </p>
          <p>
            Provenance also differed by year:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>
              <span className="text-foreground">2025</span> — Publicly available official
              results. Source:{' '}
              <a href="https://2025electionresults.comelec.gov.ph/coc-result" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                2025electionresults.comelec.gov.ph
              </a>.
            </li>
            <li>
              <span className="text-foreground">2022</span> — Publicly available official
              results. Source:{' '}
              <a href="https://comelec.gov.ph/?r=2022NLE/ElectionResults_/SenatorialSummaryStatementofVotes" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                comelec.gov.ph
              </a>.
            </li>
            <li>
              <span className="text-foreground">2019</span> — Manually scraped from source.{' '}
              <a href="https://comelec.gov.ph" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                comelec.gov.ph
              </a>.
            </li>
            <li>
              <span className="text-foreground">2016</span> — Manually scraped from source, a
              dedicated COMELEC results microsite for that election that is likely no longer
              live. Linked to the COMELEC homepage as a fallback:{' '}
              <a href="https://comelec.gov.ph" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                comelec.gov.ph
              </a>.
            </li>
            <li>
              <span className="text-foreground">2013 and 2007</span> — Sourced from NAMFREL
              archives. These were already tabulated but required manual cleaning before use.{' '}
              <a href="https://namfrel.org.ph" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                namfrel.org.ph
              </a>.
            </li>
            <li>
              <span className="text-foreground">2010</span> — Sourced from COMELEC archives.
              Source:{' '}
              <a href="https://comelec.gov.ph/?r=2010NLE" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">
                comelec.gov.ph
              </a>.
            </li>
          </ul>
          <p>
            Candidate profile photos shown elsewhere on the site are a separate, auxiliary
            asset set, not part of the vote-count spreadsheets above.
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>
              Photo files used by the app are downloaded from{' '}
              <span className="text-foreground">Wikimedia Commons</span>{' '}
              (<a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:no-underline">commons.wikimedia.org</a>)
              {' '}and its standard thumbnail CDN at{' '}
              <span className="text-foreground">upload.wikimedia.org</span>.
            </li>
            <li>
              The app only uses Commons files whose file pages indicate a reusable license,
              most commonly{' '}
              <span className="text-foreground">public domain Philippine government works</span>,
              {' '}<span className="text-foreground">public domain / CC0 / PD-self uploads</span>,
              {' '}or <span className="text-foreground">Creative Commons licenses</span>{' '}
              such as CC BY or CC BY-SA.
            </li>
            <li>
              A smaller number of legacy Commons files may also carry other reusable licenses
              such as the <span className="text-foreground">GNU Free Documentation License</span>.
            </li>
            <li>
              Some Commons files were originally uploaded there from official government office
              pages, agency archives, Flickr, or uploader-owned photographs, but this project
              relies on the reusable license disclosed on the Commons file page rather than
              treating the upstream website itself as automatically reusable.
            </li>
            <li>
              If no clearly reusable single-person photo can be verified, the site falls back
              to initials instead of displaying an unverified image.
            </li>
          </ul>
        </Section>

        <Section id="sec-standardizing" n={2} title="Standardizing the format">
          <p>
            Every file was converted from its original &quot;wide&quot; layout (one column per
            candidate) into a single, uniform structure: one row per candidate, per
            municipality, per year, with the vote count. This produces one consistent format
            across all seven years regardless of how many candidates ran in a given year, and
            allows the years to be combined directly.
          </p>
        </Section>

        <Section id="sec-removing-non-vote" n={3} title="Removing non-vote data">
          <p>
            Each file was checked for columns or rows that were not vote counts before
            combining, since including them would have inflated totals. The following were
            identified and removed:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>
              <span className="text-foreground">2007</span> — A block of columns summarizing
              the top winners was present alongside the actual per-candidate columns. Removed
              to prevent double-counting.
            </li>
            <li>
              <span className="text-foreground">2013</span> — Alongside each candidate&apos;s
              vote count was a second column showing that candidate&apos;s rank in the
              municipality (a small ranking number, not a vote total). Rank columns were
              removed; only vote columns were retained.
            </li>
            <li>
              <span className="text-foreground">2016</span> — A row labeled
              &quot;TOTAL,&quot; summarizing the entire country&apos;s results in a single
              line, was present in the file. This row was excluded, as including it would
              have duplicated the national vote count.
            </li>
            <li>
              <span className="text-foreground">2022 and 2025</span> — Redundant text columns
              repeating municipality names, and percentage columns, were identified and
              removed.
            </li>
          </ul>
          <p>
            Row and column counts were checked against expected totals after each removal to
            confirm no vote data was lost or duplicated in the process.
          </p>
        </Section>

        <Section id="sec-location-code" n={4} title="Correcting a missing location code">
          <p>
            One municipality, in Lanao del Sur, was missing its official location code in the
            2007 and 2016 files, which would have excluded it from geographic analysis.
            Investigation identified that this municipality had been officially renamed (from
            &quot;Bumbaran&quot; to &quot;Amai Manabilang&quot;); the earlier files used the
            former name, which no longer matched the current official location registry. The
            correct location code was applied manually to this municipality&apos;s records in
            both years, based on the current official registry (PSGC).
          </p>
          <p>
            Genuine overseas absentee voting (OAV) records within the 2016 file were
            identified separately (17 entries, one per country/post) and kept in a separate
            dataset, since they do not correspond to a Philippine municipality.
          </p>
        </Section>

        <Section id="sec-name-resolution" n={5} title="Resolving candidate name inconsistencies">
          <p>
            Candidate names were not recorded consistently across years. The same individual
            could appear under different formats, for example:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>&quot;Drilon, Franklin M.&quot; in one year, &quot;Drilon, Frank&quot; in another</li>
            <li>&quot;Osmeña, Sergio III D.&quot; in one year, &quot;Osmena, Sergio III&quot; in another</li>
            <li>&quot;Pacquiao, Manny&quot; in one year, &quot;Pacquiao, Manny Pacman&quot; in another</li>
          </ul>
          <p>
            Without correction, each name variation would be treated as a separate
            individual, fragmenting one candidate&apos;s record across years. A reference
            table was built mapping each name variation found in the source files to one
            standardized identity per candidate. Each mapping was verified against public
            sources before being applied.
          </p>
          <p>
            Cases involving genuinely different people with similar names were also
            identified and kept separate, for example: &quot;Enrile, Juan Ponce Jr.&quot; and
            &quot;Enrile, Juan Ponce Sr.&quot; (father and son, both candidates in different
            years). A dedicated check was run across the full dataset to identify any
            remaining cases where the same person may have been split into more than one
            record, since this type of error is not otherwise visible without directly
            checking for it.
          </p>
        </Section>

        <Section id="sec-verification" n={6} title="Verification">
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>No negative vote counts were present.</li>
            <li>
              Total votes, number of candidates, and number of municipalities were reviewed
              for each year to identify any unexpected increase or decrease.
            </li>
            <li>
              The highest vote totals were checked against known candidates and major cities,
              to confirm results were consistent with expectations.
            </li>
            <li>
              The final combined row count was confirmed to match the expected count after
              removing non-vote rows, with no unexplained gain or loss of records.
            </li>
          </ul>
        </Section>

        <Section id="sec-final-structure" n={7} title="Final data structure">
          <p>
            The verified dataset was reorganized into three linked tables to reduce file size
            and repetition:
          </p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>A table of municipalities (location codes and names).</li>
            <li>A table of candidates (standardized identity per candidate).</li>
            <li>
              A table of vote records (year, municipality, candidate, and vote count),
              referencing the two tables above rather than repeating names on every row.
            </li>
          </ul>
          <p>
            This reduced the dataset&apos;s file size substantially while preserving all
            original information. A single, non-restructured version of the full dataset is
            also retained for reference and audit purposes.
          </p>
        </Section>

        <Section id="sec-status" n={8} title="Status">
          <p>
            All seven years are integrated using this process. A small number of candidate
            name mappings remain under final review. Future election years will be
            incorporated following the same procedure to maintain consistency.
          </p>
        </Section>

        <div className="space-y-1 pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Part 2
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Reference</h2>
        </div>

        <section id="sec-definitions" className="space-y-6 scroll-mt-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              What the numbers on this site mean
            </h2>
            <p className="text-sm text-muted-foreground">
              The sections above explain how the underlying vote counts were collected and
              cleaned. This part explains what happens after that — how a raw vote count turns
              into the percentages, rankings, and &quot;swing&quot; figures shown on candidate
              pages, charts, and the map.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Vote share</h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="text-foreground">Vote share</span>{' '}is the percentage of votes
                a candidate received out of all votes cast for senatorial candidates in a given
                place, for a single election year — a municipality, a province, or the whole
                country.
              </p>
              <p>
                It is <em>not</em>{' '}a share of registered voters or of total ballots cast.
                Concretely: if a municipality cast 100,000 votes across all senatorial
                candidates combined, and one candidate received 15,000 of those, that
                candidate&apos;s vote share there is 15%. A candidate&apos;s national vote
                share works the same way, just adding up votes across the whole country instead
                of one municipality.
              </p>
              <p>
                This is also why vote shares for all candidates in one place roughly add up to
                100% — everyone is being measured against the same pool of votes.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Rank</h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="text-foreground">Rank</span>{' '}is a candidate&apos;s position
                among all candidates in a given place and year, based on raw vote counts —
                whoever got the most votes is rank 1, and so on. This is true at every level
                the site shows a rank: within a municipality, within a province, and
                nationally.
              </p>
              <p>
                Rank is based on vote count, not vote share. This matters because rank and vote
                share can move in different directions: if a strong new candidate enters a race
                and takes votes from other candidates, someone&apos;s rank can drop even though
                their own vote share barely changed, since it depends on everyone else in the
                race too. Vote share only reflects a candidate&apos;s own support, not how it
                compares to others.
              </p>
              <p>
                If two candidates receive the exact same number of votes in a place, they share
                the same rank, and the next candidate down is ranked as if no one had tied — for
                example, two candidates tied for 3rd are both shown as rank 3, and the next
                candidate is rank 5, not 4.
              </p>
            </div>
          </div>

          <div id="vote-share-swing" className="space-y-3 scroll-mt-6">
            <h3 className="text-base font-medium text-foreground">Vote-share swing</h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <span className="text-foreground">Swing</span>{' '}is how much a candidate&apos;s
                own vote share changed between two of their election runs — for example, from
                20% in one election to 21.3% in a later one is a swing of{' '}
                <span className="text-foreground">+1.3 points</span>.
              </p>
              <p>
                Swing is shown in <span className="text-foreground">percentage points</span>,
                not percent — the difference matters. Going from 20% to 21.3% is a change of 1.3
                percentage points, even though it is a 6.5% relative increase in support. This
                site always uses the percentage-point version (written as &quot;pt&quot;, e.g.
                &quot;+1.3pt&quot;), since it directly reflects how much of the electorate a
                candidate gained or lost, rather than how big that change was relative to their
                starting point.
              </p>
              <p>
                &quot;Previous election&quot; does not mean a single fixed year for every
                candidate — it means that specific candidate&apos;s own most recent prior run.
                A candidate who ran in 2016 and again in 2025, skipping 2019 and 2022 in
                between, is compared 2016-to-2025 by default. A year picker lets you compare any
                two of a candidate&apos;s runs, not just their two most recent ones. Candidates
                who have only run once have no swing to show, since there is nothing earlier to
                compare against.
              </p>
              <p>
                A swing that rounds to 0.0pt is treated as essentially unchanged (&quot;flat&quot;),
                not as a small gain or loss, and is colored gray rather than green or red — this
                avoids implying a meaningful shift happened when the numbers barely moved at
                all.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">
              How swing colors and summaries are decided
            </h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                On the map and in bar charts, green means a candidate&apos;s vote share went up
                in that place between the two selected elections, red means it went down, and
                gray means it stayed effectively flat. Darker shades mean a bigger swing;
                lighter shades mean a smaller one. The darkest shade always represents the
                single largest swing found anywhere in the current view, so color intensity is
                relative to that election and that candidate, not a fixed scale.
              </p>
              <p>
                Summary lines like &quot;gained support in 111 out of 113 provinces&quot; are
                counted across every province or municipality where that candidate has data in
                both years being compared — not just the handful of bars a chart displays at
                once. Charts that can&apos;t fit every place on screen show a representative
                sample instead (the biggest drop, the biggest gain, and a few points in between),
                but the counts and percentages in the summary text always reflect the full
                dataset.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">
              Province strength (&quot;1.4x national average&quot;)
            </h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Some province charts show a candidate&apos;s performance as a multiple of their
                own national average that year, instead of a raw percentage — for example,
                &quot;1.4x&quot; means the candidate did 40% better in that province than they
                did nationally that same year; &quot;0.7x&quot; means 30% worse. A value of
                exactly 1.0x means the province matched their national performance exactly.
              </p>
              <p>
                This is a different figure from{' '}
                <a href="#vote-share-swing" className="text-primary underline underline-offset-2 hover:no-underline">
                  vote-share swing
                </a>{' '}
                above — it compares a candidate against <em>themselves</em>, in one place
                versus the whole country, within a single election, rather than comparing the
                same place across two different elections.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">&quot;Did not run&quot;</h3>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                A candidate is shown as &quot;did not run&quot; in a given year simply when
                there is no record of them appearing on the ballot that year in the source
                data — it is not a computed statistic, just a direct reflection of whether that
                election&apos;s file contains an entry for them at all.
              </p>
            </div>
          </div>
        </section>

        <section id="sec-faq" className="space-y-4 scroll-mt-6">
          <h2 className="text-lg font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(faq => (
              <div key={faq.question} className="space-y-1">
                <p className="text-sm font-medium">{faq.question}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {/* JSON-LD (faqJsonLd) reads faq.answer directly as plain text, so the link
                      below is a display-only override — the schema data stays a plain string. */}
                  {faq.question.startsWith('Does the site show voter turnout') ? (
                    <>
                      No. The source files&rsquo; registered-voter and ballot-count columns were
                      removed early in cleaning (see{' '}
                      <a href="#sec-removing-non-vote" className="text-primary underline underline-offset-2 hover:no-underline">
                        &quot;Removing non-vote data&quot;
                      </a>{' '}
                      above) because they were inconsistent and not needed for vote-share or rank
                      calculations, so no turnout percentage or victory-margin figure is computed
                      anywhere on the site.
                    </>
                  ) : faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div id="disclaimer" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1.5 scroll-mt-20">
          <p className="text-sm font-medium text-destructive">Rankings and totals will not match official results</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The rankings, tallies, and vote counts shown here do not correspond exactly to
            official COMELEC results. This dataset was painstakingly compiled municipality by
            municipality from individually sourced files rather than a single authoritative
            feed, and results from some municipalities are missing. Where a municipality is
            missing, its votes are absent from every total, rank, and vote share computed
            from this dataset — national and provincial figures included — so outcomes shown
            here can diverge from the official count. This is an independent, unofficial
            project, not affiliated with or verified by COMELEC. If a number looks wrong,
            treat it as a reason to verify against COMELEC&apos;s official results, not as
            certain.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Province-level charts, tables, and the map also list Highly Urbanized Cities
            (Davao City, Cebu City, Iloilo City, and others) as their own entries alongside
            their geographic province, since these cities are administratively independent
            and are reported separately in the underlying data. See the FAQ above for details.
          </p>
        </div>

          </div>
        </div>
      </main>
    </div>
  );
}
