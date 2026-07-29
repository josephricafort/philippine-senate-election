import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import ShareButton from '@/components/ShareButton';
import PlatformShareLinks from '@/components/PlatformShareLinks';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateMunicipalitySwingHeadline, resolveShareYearPair } from '@/lib/data';
import type { Senator } from '@/lib/types';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ yearA?: string; yearB?: string }>;
};

async function getSenator(slug: string): Promise<Senator | null> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  return senators.find(s => s.senator_id === slug) ?? null;
}

async function getHeadline(senator: Senator, query: { yearA?: string; yearB?: string }) {
  const pair = resolveShareYearPair(senator, query);
  if (!pair) return null;
  const [yearA, yearB] = pair;
  const candidate = await loadCandidateDataServer(senator.senator_id);
  if (!candidate.years[String(yearA)] || !candidate.years[String(yearB)]) return null;
  return candidateMunicipalitySwingHeadline(candidate, senator, yearA, yearB);
}

export async function generateStaticParams() {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  const eligible: { slug: string }[] = [];
  for (const senator of senators) {
    const runs = [...senator.years].sort((a, b) => a - b);
    if (runs.length < 2) continue;
    const yearA = runs[runs.length - 2];
    const yearB = runs[runs.length - 1];
    const candidate = await loadCandidateDataServer(senator.senator_id);
    if (!candidate.years[String(yearA)] || !candidate.years[String(yearB)]) continue;
    if (candidateMunicipalitySwingHeadline(candidate, senator, yearA, yearB)) {
      eligible.push({ slug: senator.senator_id });
    }
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

  // Same reasoning as the province-swing card: the headline itself is the title, and image
  // dimensions must match the og-image route's actual output (1200x630) exactly.
  const title = result.headline;
  const description = `Municipality swing map, ${result.yearA} → ${result.yearB}. Explore all Philippine senate election data since 2007.`;
  const imageUrl = `/senator/${senator.senator_id}/share/map/og-image?yearA=${result.yearA}&yearB=${result.yearB}`;
  const imageAlt = result.headline;

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

export default async function MapSwingSharePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const senator = await getSenator(slug);
  if (!senator) notFound();

  const result = await getHeadline(senator, query);
  if (!result) notFound();

  const shareQuery = `?yearA=${result.yearA}&yearB=${result.yearB}`;
  // Every share surface on this page (Facebook, X, copy-link, native share, "See full profile")
  // points at the interactive explorer, deep-linked to this candidate and year pair, rather than
  // this static share-card page — so anyone who opens a shared link lands in the live map/profile.
  // view=map tells the explorer's own generateMetadata (src/app/page.tsx) which headline/og-image
  // to resolve — without it, that page can't distinguish a map share from a province share since
  // both otherwise produce the identical ?candidate=&yearA=&yearB= shape.
  const exploreUrl = `/?candidate=${senator.senator_id}&yearA=${result.yearA}&yearB=${result.yearB}&view=map`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-3">
        <Link
          href={exploreUrl}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to explorer
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* This IS the og:image, rendered inline — one source of truth for what gets
            previewed here vs. what platforms fetch when the link is shared. */}
        <div className="rounded-2xl overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/senator/${senator.senator_id}/share/map/og-image${shareQuery}`}
            alt={result.headline}
            className="w-full block"
          />
        </div>

        <div>
          <p className="text-base font-semibold mb-3">Share this</p>
          <PlatformShareLinks
            url={exploreUrl}
            title={`${senator.senator_name} — Municipality swing map, ${result.yearA} → ${result.yearB}`}
            xText={result.headline}
            candidateId={senator.senator_id}
          />
        </div>

        <ShareButton
          title={`${senator.senator_name} — Municipality swing map`}
          text={result.headline}
          candidateId={senator.senator_id}
          url={exploreUrl}
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
