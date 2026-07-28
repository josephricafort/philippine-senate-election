import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import ShareButton from '@/components/ShareButton';
import PlatformShareLinks from '@/components/PlatformShareLinks';
import { loadCandidateIndexServer, loadAllVotesServer } from '@/lib/data-server';
import { buildSenatorList, provinceSwingHeadline, resolveShareYearPair } from '@/lib/data';
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
  const voteCache = await loadAllVotesServer();
  const pair = resolveShareYearPair(senator, query);
  if (!pair) return null;
  const [yearA, yearB] = pair;
  const voteDataA = voteCache.get(yearA);
  const voteDataB = voteCache.get(yearB);
  if (!voteDataA || !voteDataB) return null;
  return provinceSwingHeadline(voteDataA, voteDataB, senator, yearA, yearB);
}

export async function generateStaticParams() {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  const voteCache = await loadAllVotesServer();
  const eligible: { slug: string }[] = [];
  for (const senator of senators) {
    const runs = [...senator.years].sort((a, b) => a - b);
    if (runs.length < 2) continue;
    const yearA = runs[runs.length - 2];
    const yearB = runs[runs.length - 1];
    const voteDataA = voteCache.get(yearA);
    const voteDataB = voteCache.get(yearB);
    if (!voteDataA || !voteDataB) continue;
    if (provinceSwingHeadline(voteDataA, voteDataB, senator, yearA, yearB)) {
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

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
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
            src={`/senator/${senator.senator_id}/share/province/opengraph-image${shareQuery}`}
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
