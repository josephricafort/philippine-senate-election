import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import ShareButton from '@/components/ShareButton';
import PlatformShareLinks from '@/components/PlatformShareLinks';
import ShareBarChart from '@/components/ShareBarChart';
import SiteHeader from '@/components/SiteHeader';
import ShareCardViewTracker from '@/components/ShareCardViewTracker';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import {
  buildSenatorList, candidateProvinceSwingHeadline, candidateTopProvincesHeadline, resolveShareYearPair,
  type ProvinceSwingHeadline, type TopProvincesHeadline,
} from '@/lib/data';
import type { Senator } from '@/lib/types';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ yearA?: string; yearB?: string }>;
};

type HeadlineResult =
  | { kind: 'swing'; data: ProvinceSwingHeadline }
  | { kind: 'top'; data: TopProvincesHeadline };

async function getSenator(slug: string): Promise<Senator | null> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  return senators.find(s => s.senator_id === slug) ?? null;
}

// Prefers the province-swing headline for the resolved year pair; falls back to "top provinces
// by vote share" for the candidate's latest run when there's no swing data (single-run
// candidates, or a year pair with zero comparable provinces) — see candidateTopProvincesHeadline
// for why the fallback itself can't return null for any candidate with real votes.
async function getHeadline(senator: Senator, query: { yearA?: string; yearB?: string }): Promise<HeadlineResult | null> {
  const candidate = await loadCandidateDataServer(senator.senator_id);
  const pair = resolveShareYearPair(senator, query);
  if (pair) {
    const [yearA, yearB] = pair;
    if (candidate.years[String(yearA)] && candidate.years[String(yearB)]) {
      const swing = candidateProvinceSwingHeadline(candidate, senator, yearA, yearB);
      if (swing) return { kind: 'swing', data: swing };
    }
  }
  const latestYear = Math.max(...senator.years);
  const top = candidateTopProvincesHeadline(candidate, senator, latestYear);
  return top ? { kind: 'top', data: top } : null;
}

export async function generateStaticParams() {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  const eligible: { slug: string }[] = [];
  for (const senator of senators) {
    if (senator.years.length === 0) continue;
    eligible.push({ slug: senator.senator_id });
  }
  return eligible;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const senator = await getSenator(slug);
  if (!senator) return { title: 'Candidate not found' };

  const result = await getHeadline(senator, query);
  if (!result) return { title: 'Candidate not found' };

  // The headline itself ("Bong Go gained support from 89 out of 117 (76%)..." or, for the
  // top-provinces fallback, "Camille Villar got the highest share of votes in these
  // provinces in 2025.") is the title — it's the actual claim being shared, not a generic
  // label, so the link preview leads with the same statement the graphic makes.
  const title = result.data.headline;
  const description = result.kind === 'swing'
    ? `${senator.senator_name}'s province vote-share swing, ${result.data.yearA} → ${result.data.yearB}. Explore all Philippine senate election data since 2007.`
    : `Vote share by province, ${result.data.year}. Explore all Philippine senate election data since 2007.`;
  // og-image is a plain Route Handler, not the opengraph-image.tsx file convention (that
  // convention's Image() only receives `params`, not `searchParams`, in this Next.js version,
  // so it can't see which year pair was selected) — meaning og:image/twitter:image tags aren't
  // auto-populated and need to be set explicitly here. Dimensions must match the route's actual
  // output (1200x630) — X's card validator drops the image entirely on a size mismatch, which
  // is why it wasn't showing a preview while Facebook (more lenient) still did. The route itself
  // resolves the same swing-or-top-provinces fallback from the same query params, so this URL
  // works whether `result` ended up being swing or top-provinces.
  const imageUrl = result.kind === 'swing'
    ? `/senator/${senator.senator_id}/share/province/og-image?yearA=${result.data.yearA}&yearB=${result.data.yearB}`
    : `/senator/${senator.senator_id}/share/province/og-image`;
  const imageAlt = result.data.headline;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      // Full descriptor (not a bare URL string) — X's crawler has been reported to silently
      // skip summary_large_image cards that omit type/width/height here even when the same
      // image works fine as a bare-string og:image for Facebook.
      images: [{ url: imageUrl, alt: imageAlt, type: 'image/png', width: 1200, height: 630 }],
    },
  };
}

export default async function ProvinceSwingSharePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const senator = await getSenator(slug);
  if (!senator) notFound();

  const result = await getHeadline(senator, query);
  if (!result) notFound();

  // Every share surface on this page (Facebook, X, copy-link, native share, "See full profile")
  // points at the interactive explorer, deep-linked to this candidate, rather than this static
  // share-card page — so anyone who opens a shared link lands in the live map/profile. For the
  // swing case, view=province + the year pair tells the explorer's own generateMetadata
  // (src/app/page.tsx) which headline/og-image to resolve; the top-provinces fallback has no
  // year-pair/view concept to hand off, so it just deep-links the candidate.
  const shareQuery = result.kind === 'swing' ? `?yearA=${result.data.yearA}&yearB=${result.data.yearB}` : '';
  const imageUrl = `/senator/${senator.senator_id}/share/province/og-image${shareQuery}`;
  const exploreUrl = result.kind === 'swing'
    ? `/?candidate=${senator.senator_id}&yearA=${result.data.yearA}&yearB=${result.data.yearB}&view=province`
    : `/?candidate=${senator.senator_id}`;
  const shareTitle = result.kind === 'swing'
    ? `${senator.senator_name} — Vote-share swing, ${result.data.yearA} → ${result.data.yearB}`
    : `${senator.senator_name} — Vote share by province, ${result.data.year}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {result.kind === 'swing' ? (
        <ShareCardViewTracker
          candidateId={senator.senator_id}
          cardType="province_swing"
          yearA={result.data.yearA}
          yearB={result.data.yearB}
        />
      ) : (
        <ShareCardViewTracker
          candidateId={senator.senator_id}
          cardType="top_provinces"
          yearA={result.data.year}
        />
      )}
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link
          href={exploreUrl}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to explorer
        </Link>

        {/* This IS the og:image, rendered inline — one source of truth for what gets
            previewed here vs. what platforms fetch when the link is shared. */}
        <div className="rounded-2xl overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={result.data.headline}
            className="w-full block"
          />
        </div>

        {result.kind === 'top' && (
          // Full top-15 list (the og-image above only fits 10) — same bar+rank presentation as
          // the Trends tab's "Share by province" table, just fed this candidate's single latest
          // year instead of every province they have data for.
          <ShareBarChart
            title={`Share by province · ${result.data.year}`}
            rows={result.data.rows.map(r => ({ key: r.adm2_en, name: r.adm2_en, vote_share: r.vote_share, rank: r.rank, trend: [] }))}
            nameHeader="Province"
            shareHeader="Share"
            sampleSize={15}
            emptyMessage="No province data available."
            year={result.data.year}
            singleRun
          />
        )}

        <div>
          <p className="text-base font-semibold mb-3">Share this</p>
          <PlatformShareLinks
            url={exploreUrl}
            title={shareTitle}
            xText={result.data.headline}
            candidateId={senator.senator_id}
            source="share_card_province"
          />
        </div>

        <ShareButton
          title={shareTitle}
          text={result.data.headline}
          candidateId={senator.senator_id}
          url={exploreUrl}
          source="share_card_province"
        />

        <Link
          href={exploreUrl}
          className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold text-xs">
            {senator.senator_name.slice(0, 2).toUpperCase()}
          </div>
          <span className="flex-1 text-sm font-medium leading-snug">
            See {senator.senator_name}&rsquo;s full profile
          </span>
        </Link>
      </main>
    </div>
  );
}
