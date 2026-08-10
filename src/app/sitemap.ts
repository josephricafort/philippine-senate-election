import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { loadCandidateIndexServer } from '@/lib/data-server';
import { buildSenatorList } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // Query-string explorer URLs (/?candidate=&year=) are the discoverable/indexed form for
  // candidates now, not /senator/[slug] (see robots.ts — that route family is disallowed from
  // crawling). One entry per candidate per year they ran, so a specific historical run (e.g.
  // a 2013 loss) is independently indexable, not just each candidate's latest year.
  const candidateRoutes: MetadataRoute.Sitemap = senators.flatMap(senator =>
    senator.years.map(year => ({
      url: `${SITE_URL}/?candidate=${senator.senator_id}&year=${year}`,
      changeFrequency: 'yearly' as const,
      priority: 0.8,
    }))
  );

  return [...staticRoutes, ...candidateRoutes];
}
