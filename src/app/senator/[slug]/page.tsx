import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPinned } from 'lucide-react';

import CandidateCard, { CandidateHeader } from '@/components/CandidateCard';
import TrendChart from '@/components/TrendChart';
import TopProvincesTable from '@/components/TopProvincesTable';
import TopMunicipalitiesTable from '@/components/TopMunicipalitiesTable';
import SwingSection from '@/components/SwingSection';
import ShareButton from '@/components/ShareButton';
import SectionIntro from '@/components/SectionIntro';
import { loadCandidateIndexServer, loadVotesForYearsServer } from '@/lib/data-server';
import {
  buildSenatorList, topMunicipalities, topProvinces, trendData,
  provinceList, provinceShareTrend, provinceSwing, municipalitySwing,
} from '@/lib/data';
import { yearColor } from '@/lib/year-colors';
import { netSwing, consecutivePairs, type YearPair } from '@/lib/swing';
import { headlineName } from '@/lib/display-name';
import { SITE_URL } from '@/lib/site';
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

  const voteCache = await loadVotesForYearsServer(senator.years);
  const latestYear = Math.max(...senator.years) as ElectionYear;
  const latestVoteData = voteCache.get(latestYear) ?? null;
  // Static share page has no interactive pair-picker — always shows the most recent pair.
  const pairs = consecutivePairs(senator.years);
  const swingYearPair: YearPair | null = pairs.length > 0 ? pairs[pairs.length - 1] : null;

  const topMunis = latestVoteData ? topMunicipalities(latestVoteData, senator.senator_id, 7) : [];
  const topProvs = latestVoteData ? topProvinces(latestVoteData, senator.senator_id, 7) : [];
  const trend = trendData(voteCache, senator.senator_id);

  // SwingSection needs per-senator, per-province numbers, not the raw multi-year, all-candidates
  // voteCache — passing voteCache itself into that (client) component would serialize the full
  // municipality-level dataset into the page's RSC payload, which is what blew several senator
  // pages past Vercel's 19MB static-page size limit. Reduce everything down here instead.
  const allProvinces = latestVoteData ? provinceList(latestVoteData) : [];
  const provinceTrends = allProvinces.map(adm2_en => ({
    adm2_en,
    trend: provinceShareTrend(voteCache, senator.senator_id, adm2_en),
  }));
  const topProvinceNames = latestVoteData
    ? topProvinces(latestVoteData, senator.senator_id, 4).map(p => p.adm2_en)
    : [];

  const [swingYearA, swingYearB] = swingYearPair ?? [undefined, undefined];
  const swingVoteDataA = swingYearA !== undefined ? voteCache.get(swingYearA) : undefined;
  const swingVoteDataB = swingYearB !== undefined ? voteCache.get(swingYearB) : undefined;
  const swingProvinceRows = (swingVoteDataA && swingVoteDataB)
    ? provinceSwing(swingVoteDataA, swingVoteDataB, senator.senator_id)
    : [];
  const muniRowsByProvince: Record<string, ReturnType<typeof municipalitySwing>> = {};
  if (swingVoteDataA && swingVoteDataB) {
    for (const adm2_en of allProvinces) {
      muniRowsByProvince[adm2_en] = municipalitySwing(swingVoteDataA, swingVoteDataB, senator.senator_id, adm2_en);
    }
  }

  // One-sentence takeaways stating what each section's numbers actually show, computed from
  // the same data the chart/table below it renders — not a generic description of chart type.
  const trendSwing = netSwing(trend);
  const trendTakeaway = trend.length > 1
    ? `National vote share ${trendSwing >= 0 ? 'rose' : 'fell'} ${Math.abs(trendSwing * 100).toFixed(1)}pt from ${trend[0].year} to ${trend[trend.length - 1].year}, landing at ${(trend[trend.length - 1].vote_share * 100).toFixed(1)}% in ${latestYear}.`
    : trend.length === 1
    ? `${senator.senator_name} has only run once (${trend[0].year}), earning ${(trend[0].vote_share * 100).toFixed(1)}% of the national vote share — no prior run to compare against yet.`
    : null;

  const topProvinceTakeaway = topProvs.length > 0
    ? `Strongest in ${topProvs[0].adm2_en} in ${latestYear}, at ${(topProvs[0].vote_share * 100).toFixed(1)}% of the vote (rank #${topProvs[0].rank}).`
    : null;

  const topMuniTakeaway = topMunis.length > 0
    ? `Best single town was ${topMunis[0].adm3_en}, ${topMunis[0].adm2_en}, at ${(topMunis[0].vote_share * 100).toFixed(1)}% of the vote in ${latestYear}.`
    : null;

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: headlineName(senator.senator_name),
    alternateName: senator.senator_name,
    url: `${SITE_URL}/senator/${senator.senator_id}`,
    jobTitle: 'Philippine senatorial candidate',
    description: `Senatorial candidate in the Philippine Senate election${senator.years.length > 1 ? 's' : ''} of ${senator.years.join(', ')}.`,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
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
            candidateId={senator.senator_id}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-10">
        <div className="space-y-4 md:space-y-6">
          <CandidateHeader senator={senator} national={latestVoteData?.national[senator.senator_id] ?? null} />
          <CandidateCard senator={senator} national={latestVoteData?.national[senator.senator_id] ?? null} year={latestYear} />
        </div>

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
          <SwingSection
            senator={senator}
            provinceTrends={provinceTrends}
            topProvinceNames={topProvinceNames}
            provinceRows={swingProvinceRows}
            muniRowsByProvince={muniRowsByProvince}
            yearPair={swingYearPair}
          />
        </Suspense>

        {trendTakeaway && (
          <div>
            <SectionIntro label="National vote trends">{trendTakeaway}</SectionIntro>
            <TrendChart data={trend} />
          </div>
        )}

        <div>
          {topProvinceTakeaway && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{topProvinceTakeaway}</p>
          )}
          <TopProvincesTable rows={topProvs} metric="vote_share" year={latestYear} />
        </div>

        <div>
          {topMuniTakeaway && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{topMuniTakeaway}</p>
          )}
          <TopMunicipalitiesTable rows={topMunis} metric="vote_share" year={latestYear} />
        </div>

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
