import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import ShareButton from '@/components/ShareButton';
import PlatformShareLinks from '@/components/PlatformShareLinks';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateProvinceSwingHeadline, resolveShareYearPair } from '@/lib/data';
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
  return candidateProvinceSwingHeadline(candidate, senator, yearA, yearB);
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
    if (candidateProvinceSwingHeadline(candidate, senator, yearA, yearB)) {
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

  const title = `${senator.senator_name} — Province swing, ${result.yearA} → ${result.yearB}`;
  const description = result.headline;
  // og-image is a plain Route Handler, not the opengraph-image.tsx file convention (that
  // convention's Image() only receives `params`, not `searchParams`, in this Next.js version,
  // so it can't see which year pair was selected) — meaning og:image/twitter:image tags aren't
  // auto-populated and need to be set explicitly here.
  const imageUrl = `/senator/${senator.senator_id}/share/province/og-image?yearA=${result.yearA}&yearB=${result.yearB}`;
  const imageAlt = 'Philippine Senate Election Explorer — Province swing';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1080, height: 1350, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
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

  const shareQuery = `?yearA=${result.yearA}&yearB=${result.yearB}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-3">
        <Link
          href={`/?candidate=${senator.senator_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to explorer
        </Link>
      </header>

      <main className="max-w-lg mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* This IS the og:image, rendered inline — one source of truth for what gets
            previewed here vs. what platforms fetch when the link is shared. */}
        <div className="rounded-2xl overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/senator/${senator.senator_id}/share/province/og-image${shareQuery}`}
            alt={result.headline}
            className="w-full block"
          />
        </div>

        <div>
          <p className="text-base font-semibold mb-3">Share this</p>
          <PlatformShareLinks
            url={`/senator/${senator.senator_id}/share/province${shareQuery}`}
            title={`${senator.senator_name} — Province swing, ${result.yearA} → ${result.yearB}`}
            xText={result.headline}
            candidateId={senator.senator_id}
          />
        </div>

        <ShareButton
          title={`${senator.senator_name} — Province swing`}
          text={result.headline}
          candidateId={senator.senator_id}
        />

        <Link
          href={`/senator/${senator.senator_id}`}
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
