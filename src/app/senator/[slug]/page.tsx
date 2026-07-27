import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPinned } from 'lucide-react';

import CandidateCard from '@/components/CandidateCard';
import TrendChart from '@/components/TrendChart';
import TopProvincesTable from '@/components/TopProvincesTable';
import TopMunicipalitiesTable from '@/components/TopMunicipalitiesTable';
import SwingSection from '@/components/SwingSection';
import ShareButton from '@/components/ShareButton';
import { loadCandidateIndexServer, loadAllVotesServer } from '@/lib/data-server';
import { buildSenatorList, topMunicipalities, topProvinces, trendData } from '@/lib/data';
import { yearColor } from '@/lib/year-colors';
import type { ElectionYear, Senator } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

async function getSenator(slug: string): Promise<Senator | null> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  return senators.find(s => s.senator_id === slug) ?? null;
}

export async function generateStaticParams() {
  const index = await loadCandidateIndexServer();
  return index.map(e => ({ slug: e.senator_id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const senator = await getSenator(slug);
  if (!senator) return { title: 'Candidate not found' };

  const years = senator.years.join(', ');
  const title = `${senator.senator_name} — Philippine Senate Election Results`;
  const description = `Municipality-level vote results for ${senator.senator_name} across their senatorial runs (${years}). See their strongholds, vote share trend, and where their support came from.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SenatorPage({ params }: Props) {
  const { slug } = await params;
  const senator = await getSenator(slug);
  if (!senator) notFound();

  const voteCache = await loadAllVotesServer();
  const latestYear = Math.max(...senator.years) as ElectionYear;
  const latestVoteData = voteCache.get(latestYear) ?? null;

  const topMunis = latestVoteData ? topMunicipalities(latestVoteData, senator.senator_id, 7) : [];
  const topProvs = latestVoteData ? topProvinces(latestVoteData, senator.senator_id, 7) : [];
  const trend = trendData(voteCache, senator.senator_id);

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
        <div className="ml-auto">
          <ShareButton
            title={`${senator.senator_name} — Philippine Senate Election Results`}
            text={`${senator.senator_name}'s senate voting results, ${senator.years[0]}–${senator.years[senator.years.length - 1]}`}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-10">
        <CandidateCard senator={senator} voteData={latestVoteData} year={latestYear} />

        {senator.years.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Years Ran</span>
            <div className="flex gap-1.5">
              {senator.years.map(y => (
                <span
                  key={y}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: y === latestYear ? yearColor(y) : `${yearColor(y)}1f`,
                    color: y === latestYear ? '#fff' : yearColor(y),
                  }}
                >
                  {y}
                </span>
              ))}
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <SwingSection senator={senator} voteCache={voteCache} latestVoteData={latestVoteData} />
        </Suspense>

        {senator.years.length > 1 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
              National vote trends
            </p>
            <TrendChart data={trend} />
          </div>
        )}

        <TopProvincesTable rows={topProvs} metric="vote_share" year={latestYear} />

        <TopMunicipalitiesTable rows={topMunis} metric="vote_share" year={latestYear} />

        <Link
          href={`/?candidate=${senator.senator_id}`}
          className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPinned className="w-5 h-5 text-primary" />
          </div>
          <span className="flex-1 text-sm font-medium leading-snug">
            Explore {senator.senator_name} on the interactive map, all years
          </span>
        </Link>
      </main>
    </div>
  );
}
