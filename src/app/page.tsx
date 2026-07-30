import type { Metadata } from 'next';
import { headers } from 'next/headers';

import ExplorerClient from './ExplorerClient';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import {
  buildSenatorList, candidateMunicipalitySwingHeadline, candidateProvinceSwingHeadline,
  candidateTopProvincesHeadline, resolveShareYearPair,
} from '@/lib/data';
import { siteUrlFromHeaders } from '@/lib/site';

type Props = {
  searchParams: Promise<{ candidate?: string; yearA?: string; yearB?: string; view?: string }>;
};

const title = 'BotoSenado — Philippine Senate Election Results (2007 - 2025)';
const description = "Explore every Philippine senatorial election from 2007–2025, broken down to the municipality level. Look up any candidate's vote share, rank, strongholds, and trend over time.";

// Links shared from the swing-map/province-swing cards point here (?candidate=&yearA=&yearB=&view=)
// so followers land directly in the live interactive view — but that means THIS url, not the card
// page, is what Facebook/X fetch for a link preview. Without this, every shared link previewed as
// the generic site card (src/app/opengraph-image.tsx) regardless of which candidate/years were
// shared. `view` (set by the two share/*/page.tsx pages when building this url) picks which of the
// two headline/og-image pairs to use — map and province shares otherwise produce the identical
// ?candidate=&yearA=&yearB= shape and this page can't tell them apart.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { candidate, yearA, yearB, view } = await searchParams;
  if (!candidate) return { title, description };

  const index = await loadCandidateIndexServer();
  const senator = buildSenatorList(index).find(s => s.senator_id === candidate);
  if (!senator) return { title, description };

  const candidateData = await loadCandidateDataServer(senator.senator_id);
  const isProvince = view === 'province';

  const pair = resolveShareYearPair(senator, { yearA, yearB });
  const swingResult = pair && candidateData.years[String(pair[0])] && candidateData.years[String(pair[1])]
    ? (isProvince
        ? candidateProvinceSwingHeadline(candidateData, senator, pair[0], pair[1])
        : candidateMunicipalitySwingHeadline(candidateData, senator, pair[0], pair[1]))
    : null;

  // Same og-image route the matching /senator/[slug]/share/{map,province} preview page renders —
  // one source of truth for the actual graphic, referenced here so the shared link's own preview
  // matches it. Built against the actual request host (not the static SITE_URL/metadataBase
  // fallback) so this keeps working when served from a domain other than production, e.g. a
  // Vercel preview URL used while the production domain is temporarily offline pre-launch.
  const origin = siteUrlFromHeaders(await headers());
  // The root layout's metadata sets openGraph.url to the static SITE_URL (botosenado.ph, which
  // is offline pre-launch) and Next.js does NOT merge that into this page's own returned
  // metadata — og:url ends up simply absent here. Facebook/LinkedIn tolerate a missing og:url
  // and fall back to the crawled URL, but X's card validator has been observed to silently
  // refuse to render a card at all when og:url is missing, even with a fully valid og:image —
  // so this must be set explicitly, using the actual shared URL (this exact query string), not
  // just the origin, so the tag matches what was really fetched.
  const shareUrlParams = new URLSearchParams();
  shareUrlParams.set('candidate', candidate);
  if (yearA) shareUrlParams.set('yearA', yearA);
  if (yearB) shareUrlParams.set('yearB', yearB);
  if (view) shareUrlParams.set('view', view);
  const pageUrl = `${origin}/?${shareUrlParams.toString()}`;

  let shareTitle: string;
  let shareDescription: string;
  let imageUrl: string;

  if (swingResult) {
    shareTitle = swingResult.headline;
    shareDescription = isProvince
      ? `Province swing chart, ${swingResult.yearA} → ${swingResult.yearB}. Explore all Philippine senate election data since 2007.`
      : `Municipality swing map, ${swingResult.yearA} → ${swingResult.yearB}. Explore all Philippine senate election data since 2007.`;
    const imagePath = isProvince
      ? `/senator/${senator.senator_id}/share/province/og-image?yearA=${swingResult.yearA}&yearB=${swingResult.yearB}`
      : `/senator/${senator.senator_id}/share/map/og-image?yearA=${swingResult.yearA}&yearB=${swingResult.yearB}`;
    imageUrl = `${origin}${imagePath}`;
  } else {
    // No swing data (single-run candidate, or a year pair with zero comparable provinces/
    // municipalities) — the shared link previously quietly fell back to the generic site card
    // here, which is why candidates like a first-time senator got a blank/generic preview on
    // Facebook/LinkedIn despite the /share/* card pages already knowing how to render a
    // "top provinces by vote share" fallback. Reuse that same fallback (and its og-image route)
    // here too, since THIS page's metadata — not /share/*'s — is what a crawler actually fetches
    // when a candidate's profile "Share" link is shared (see CandidateCard.tsx's shareUrl).
    const latestYear = Math.max(...senator.years);
    const topResult = candidateTopProvincesHeadline(candidateData, senator, latestYear);
    if (!topResult) return { title, description };

    shareTitle = topResult.headline;
    shareDescription = `Vote share by province, ${topResult.year}. Explore all Philippine senate election data since 2007.`;
    // Either share/*/og-image route renders the identical top-provinces fallback when no
    // yearA/yearB resolve to swing data — province is the one CandidateCard's shareUrl doesn't
    // already default to (it appends &view=map for multi-run candidates), so used here for
    // single-run candidates arriving with no view param at all.
    imageUrl = `${origin}/senator/${senator.senator_id}/share/province/og-image`;
  }

  return {
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: pageUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: shareTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      // Full descriptor (not a bare URL string) — X's crawler has been reported to silently
      // skip summary_large_image cards that omit type/width/height here even when the same
      // image works fine as a bare-string og:image for Facebook.
      images: [{ url: imageUrl, alt: shareTitle, type: 'image/png', width: 1200, height: 630 }],
    },
    alternates: { canonical: pageUrl },
  };
}

export default function Page() {
  return <ExplorerClient />;
}
