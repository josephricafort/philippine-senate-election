import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Search, Map as MapIcon, TrendingUp, ListOrdered, MapPinned, SlidersHorizontal } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About — BotoSenado',
  description: 'What this tool does and how to explore nearly two decades of Philippine senatorial election results.',
};

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-sm leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export default function AboutPage() {
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

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-12">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            BotoSenado
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Every Philippine senatorial election since 2007 — 2007, 2010, 2013, 2016, 2019,
            2022, and 2025 — broken down to the municipality level. This tool exists so you
            can see not just who won, but <em>where</em> a candidate's support actually came
            from, and how that changed from one election to the next.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Why this is useful</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            National vote counts alone flatten a lot of interesting texture. A senator's
            national rank doesn't tell you whether their votes were concentrated in a few
            provinces or spread evenly nationwide, whether they gained or lost ground since
            their last run, or which towns turned out for them hardest. This explorer surfaces
            that geography directly — useful if you're a voter sanity-checking a candidate's
            track record, a researcher or journalist looking for regional voting patterns, or
            just someone curious how your own city voted across the years.
          </p>
        </div>

        <div className="space-y-5">
          <h2 className="text-lg font-semibold tracking-tight">What you can explore</h2>

          <Feature icon={Search} title="Look up any candidate">
            Search by name to pull up every senatorial run they've made since 2007 — no need
            to know which years they ran.
          </Feature>

          <Feature icon={ListOrdered} title="See the full field, ranked">
            The leaderboard ranks every candidate for the selected year by votes, vote share,
            or rank — tap any name to jump straight to their profile.
          </Feature>

          <Feature icon={SlidersHorizontal} title="Switch how results are measured">
            Toggle between rank, vote share, and raw vote count — the map and tables update
            together, so you can compare candidates on whichever basis makes sense for your
            question.
          </Feature>

          <Feature icon={MapIcon} title="See support on the map">
            A municipality-level choropleth shows exactly where a candidate performed best or
            worst, colored by the metric you've selected.
          </Feature>

          <Feature icon={MapPinned} title="Find their strongholds">
            Top-provinces and top-municipalities tables surface exactly where a candidate's
            support was strongest in the selected year.
          </Feature>

          <Feature icon={TrendingUp} title="Track a candidate across elections">
            For candidates who've run more than once, a trend chart plots their national vote
            share over time — a quick read on whether their support is growing or fading.
          </Feature>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-1.5">
          <p className="text-sm font-medium">Getting started</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Search for a candidate, or just click a name in the leaderboard. Switch years with
            the year bar, switch metrics with the toggle, and watch the map and tables follow
            along. On mobile, the same three views — leaderboard, profile, map — live behind
            the bottom tab bar.
          </p>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1.5">
          <p className="text-sm font-medium text-destructive">Rankings and totals will not match official results</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This dataset was painstakingly compiled municipality by municipality from
            individually sourced files, and results from some municipalities are missing —
            so the rankings, tallies, and vote counts shown here can diverge from official
            COMELEC results. See{' '}
            <Link href="/methodology" className="underline underline-offset-2 hover:text-foreground">
              data &amp; methodology
            </Link>{' '}
            for details.
          </p>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Credits</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Made by{' '}
            <a
              href="https://x.com/ian_maps"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              IanMaps
            </a>
            {' & '}
            <a
              href="https://x.com/josephricafort"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Joseph Ricafort
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
