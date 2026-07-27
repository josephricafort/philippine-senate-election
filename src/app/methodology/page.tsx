import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Data & Methodology — Philippine Senate Election Explorer',
  description: 'How Senate election results from 2007–2025 were standardized, corrected, verified, and combined.',
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
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

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to explorer
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Data Processing Methodology
          </h1>
          <p className="text-sm text-muted-foreground">
            Philippine Senate election results, 2007–2025
          </p>
        </div>

        <Section n={0} title="Overview">
          <p>
            This dataset combines Senate election results from seven election years (2007,
            2010, 2013, 2016, 2019, 2022, 2025) into a single, consistent dataset showing vote
            counts per candidate per city or municipality. Each year&apos;s source file was
            released in a different format. The steps below describe how these were
            standardized, corrected, verified, and combined.
          </p>
        </Section>

        <Section n={1} title="Source data">
          <p>
            Seven files, one per election year, obtained as Excel or CSV spreadsheets. Each
            file lists municipalities in rows and candidates in columns, with vote counts in
            the cells. Formats differed by year: column names, file type, number of extra
            columns, and how missing or special entries were recorded were not consistent
            across files.
          </p>
        </Section>

        <Section n={2} title="Standardizing the format">
          <p>
            Every file was converted from its original &quot;wide&quot; layout (one column per
            candidate) into a single, uniform structure: one row per candidate, per
            municipality, per year, with the vote count. This produces one consistent format
            across all seven years regardless of how many candidates ran in a given year, and
            allows the years to be combined directly.
          </p>
        </Section>

        <Section n={3} title="Removing non-vote data">
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

        <Section n={4} title="Correcting a missing location code">
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

        <Section n={5} title="Resolving candidate name inconsistencies">
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

        <Section n={6} title="Verification">
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

        <Section n={7} title="Final data structure">
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

        <Section n={8} title="Status">
          <p>
            All seven years are integrated using this process. A small number of candidate
            name mappings remain under final review. Future election years will be
            incorporated following the same procedure to maintain consistency.
          </p>
        </Section>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1.5">
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
        </div>
      </main>
    </div>
  );
}
