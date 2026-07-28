import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { loadCandidateIndexServer, loadVotesForYearsServer } from '@/lib/data-server';
import { buildSenatorList, provinceSwingHeadline } from '@/lib/data';
import { ELECTION_YEARS } from '@/lib/types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);
  const voteCache = await loadVotesForYearsServer([...ELECTION_YEARS]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const candidateRoutes: MetadataRoute.Sitemap = senators.map(senator => ({
    url: `${SITE_URL}/senator/${senator.senator_id}`,
    changeFrequency: 'yearly',
    priority: 0.8,
  }));

  // Same eligibility rule as share/province's generateStaticParams: needs at least
  // two runs, and a computable swing headline for the most recent consecutive pair.
  const shareRoutes: MetadataRoute.Sitemap = [];
  for (const senator of senators) {
    const runs = [...senator.years].sort((a, b) => a - b);
    if (runs.length < 2) continue;
    const yearA = runs[runs.length - 2];
    const yearB = runs[runs.length - 1];
    const voteDataA = voteCache.get(yearA);
    const voteDataB = voteCache.get(yearB);
    if (!voteDataA || !voteDataB) continue;
    if (provinceSwingHeadline(voteDataA, voteDataB, senator, yearA, yearB)) {
      shareRoutes.push({
        url: `${SITE_URL}/senator/${senator.senator_id}/share/province`,
        changeFrequency: 'yearly',
        priority: 0.4,
      });
    }
  }

  return [...staticRoutes, ...candidateRoutes, ...shareRoutes];
}
