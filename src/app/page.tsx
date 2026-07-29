import type { Metadata } from 'next';

import ExplorerClient from './ExplorerClient';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateMunicipalitySwingHeadline, resolveShareYearPair } from '@/lib/data';

type Props = {
  searchParams: Promise<{ candidate?: string; yearA?: string; yearB?: string }>;
};

const title = 'BotoSenado — Philippine Senate Election Results (2007 - 2025)';
const description = "Explore every Philippine senatorial election from 2007–2025, broken down to the municipality level. Look up any candidate's vote share, rank, strongholds, and trend over time.";

// Links shared from the swing-map card point here (?candidate=&yearA=&yearB=) so followers land
// directly in the live interactive view — but that means THIS url, not the card page, is what
// Facebook/X fetch for a link preview. Without this, every shared link previewed as the generic
// site card (src/app/opengraph-image.tsx) regardless of which candidate/years were shared.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { candidate, yearA, yearB } = await searchParams;
  if (!candidate) return { title, description };

  const index = await loadCandidateIndexServer();
  const senator = buildSenatorList(index).find(s => s.senator_id === candidate);
  if (!senator) return { title, description };

  const pair = resolveShareYearPair(senator, { yearA, yearB });
  if (!pair) return { title, description };
  const [resolvedYearA, resolvedYearB] = pair;

  const candidateData = await loadCandidateDataServer(senator.senator_id);
  if (!candidateData.years[String(resolvedYearA)] || !candidateData.years[String(resolvedYearB)]) {
    return { title, description };
  }

  const result = candidateMunicipalitySwingHeadline(candidateData, senator, resolvedYearA, resolvedYearB);
  if (!result) return { title, description };

  const shareTitle = result.headline;
  const shareDescription = `Municipality swing map, ${result.yearA} → ${result.yearB}. Explore all Philippine senate election data since 2007.`;
  // Same og-image route the /senator/[slug]/share/map preview page renders — one source of
  // truth for the actual graphic, referenced here so the shared link's own preview matches it.
  const imageUrl = `/senator/${senator.senator_id}/share/map/og-image?yearA=${result.yearA}&yearB=${result.yearB}`;

  return {
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: shareTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [imageUrl],
    },
  };
}

export default function Page() {
  return <ExplorerClient />;
}
