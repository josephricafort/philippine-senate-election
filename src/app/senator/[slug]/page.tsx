import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPinned } from 'lucide-react';

import CandidateCard, { CandidateHeader } from '@/components/CandidateCard';
import TrendChart from '@/components/TrendChart';
import SwingSection from '@/components/SwingSection';
import NationalTrendsSection from '@/components/NationalTrendsSection';
import ShareButton from '@/components/ShareButton';
import SectionIntro from '@/components/SectionIntro';
import { loadCandidateIndexServer, loadCandidateDataServer, loadNationalYearServer } from '@/lib/data-server';
import {
  buildSenatorList, nationalTotalVotes,
  candidateTopProvinces, candidateTrendData,
  candidateProvinceList, candidateProvinceShareTrend, candidateProvinceSwing, candidateMunicipalitySwing,
  candidateAllProvinceShares, candidateAllMunicipalityShares,
  candidateMunicipalitySwingHeadline,
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

  const candidate = await loadCandidateDataServer(senator.senator_id);
  const latestYear = Math.max(...senator.years) as ElectionYear;
  const latestYearData = candidate.years[String(latestYear)] ?? null;
  // Static share page has no interactive pair-picker — always shows the most recent pair.
  const pairs = consecutivePairs(senator.years);
  const swingYearPair: YearPair | null = pairs.length > 0 ? pairs[pairs.length - 1] : null;

  // Nationwide total votes cast per year, for the years this senator ran — the denominator
  // candidateTrendData/candidateProvinceShareTrend need for national vote-share figures.
  const nationalYearResults = await Promise.all(
    senator.years.map(y => loadNationalYearServer(y).then(data => [y, data] as const))
  );
  const nationalTotalsByYear = new Map<number, number>(
    nationalYearResults.map(([y, data]) => [y, nationalTotalVotes(data)])
  );

  const trend = candidateTrendData(candidate, nationalTotalsByYear);

  // SwingSection needs per-senator, per-province numbers, not the raw candidate data — passing
  // the candidate object itself into that (client) component would serialize the full
  // municipality-level dataset into the page's RSC payload, which is what blew several senator
  // pages past Vercel's 19MB static-page size limit. Reduce everything down here instead.
  const allProvinces = candidateProvinceList(candidate, latestYear);
  const provinceTrends = allProvinces.map(adm2_en => ({
    adm2_en,
    trend: candidateProvinceShareTrend(candidate, nationalTotalsByYear, adm2_en),
  }));
  const topProvinceNames = candidateTopProvinces(candidate, latestYear, 4).map(p => p.adm2_en);

  const [swingYearA, swingYearB] = swingYearPair ?? [undefined, undefined];
  // Same "X gained/lost support from N out of TOTAL (%) municipalities..." claim shown on the
  // swing-map share card — reused as this page's own share text (see CandidateHeader) so that
  // share leads with a concrete number too, not just a generic "performed at the polls."
  const swingHeadline = (swingYearA !== undefined && swingYearB !== undefined)
    ? candidateMunicipalitySwingHeadline(candidate, senator, swingYearA, swingYearB)?.headline ?? null
    : null;
  const swingProvinceRows = (swingYearA !== undefined && swingYearB !== undefined)
    ? candidateProvinceSwing(candidate, swingYearA, swingYearB)
    : [];
  const muniRowsByProvince: Record<string, ReturnType<typeof candidateMunicipalitySwing>> = {};
  if (swingYearA !== undefined && swingYearB !== undefined) {
    for (const adm2_en of allProvinces) {
      muniRowsByProvince[adm2_en] = candidateMunicipalitySwing(candidate, swingYearA, swingYearB, adm2_en);
    }
  }

  // Trends tab's "share by province/municipality" data — see ExplorerClient's
  // nationalTrendsProps for the equivalent client-side computation.
  const provinceShares = candidateAllProvinceShares(candidate, latestYear);
  const trendsTopProvinceNames = candidateTopProvinces(candidate, latestYear, 4).map(p => p.adm2_en);
  const muniSharesByProvince: Record<string, ReturnType<typeof candidateAllMunicipalityShares>> = {};
  for (const p of provinceShares) {
    muniSharesByProvince[p.adm2_en] = candidateAllMunicipalityShares(candidate, latestYear, p.adm2_en);
  }

  // One-sentence takeaways stating what each section's numbers actually show, computed from
  // the same data the chart/table below it renders — not a generic description of chart type.
  const trendSwing = netSwing(trend);
  const trendTakeaway = trend.length > 1
    ? `National vote share ${trendSwing >= 0 ? 'rose' : 'fell'} ${Math.abs(trendSwing * 100).toFixed(1)}pt from ${trend[0].year} to ${trend[trend.length - 1].year}, landing at ${(trend[trend.length - 1].vote_share * 100).toFixed(1)}% in ${latestYear}.`
    : trend.length === 1
    ? `${senator.senator_name} has only run once (${trend[0].year}), earning ${(trend[0].vote_share * 100).toFixed(1)}% of the national vote share — no prior run to compare against yet.`
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
            source="profile_menu"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-10">
        <div className="space-y-4 md:space-y-6">
          <CandidateHeader senator={senator} national={latestYearData ? { national_votes: latestYearData.national_votes, national_rank: latestYearData.national_rank } : null} swingHeadline={swingHeadline} />
          <CandidateCard senator={senator} national={latestYearData ? { national_votes: latestYearData.national_votes, national_rank: latestYearData.national_rank } : null} year={latestYear} />
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

        <Suspense fallback={null}>
          <NationalTrendsSection
            year={latestYear}
            candidateId={senator.senator_id}
            candidateName={headlineName(senator.senator_name)}
            provinceShares={provinceShares}
            topProvinceNames={trendsTopProvinceNames}
            muniSharesByProvince={muniSharesByProvince}
            singleRun={senator.years.length === 1}
          />
        </Suspense>

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
