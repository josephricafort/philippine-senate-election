import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { loadCandidateIndexServer, loadCandidateDataServer } from '@/lib/data-server';
import { buildSenatorList, candidateProvinceSwingHeadline, candidateMunicipalitySwingHeadline } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await loadCandidateIndexServer();
  const senators = buildSenatorList(index);

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

  // Same eligibility rule as share/province and share/map's generateStaticParams: needs at
  // least two runs, and a computable swing headline for the most recent consecutive pair.
  // One candidate-file read per eligible senator — cheap relative to the old
  // "load all 7 years upfront" approach, and shares data-server's module-scope promise
  // cache with generateStaticParams if the same build/worker already warmed it.
  const shareRoutes: MetadataRoute.Sitemap = [];
  for (const senator of senators) {
    const runs = [...senator.years].sort((a, b) => a - b);
    if (runs.length < 2) continue;
    const yearA = runs[runs.length - 2];
    const yearB = runs[runs.length - 1];
    const candidate = await loadCandidateDataServer(senator.senator_id);
    if (!candidate.years[String(yearA)] || !candidate.years[String(yearB)]) continue;
    if (candidateProvinceSwingHeadline(candidate, senator, yearA, yearB)) {
      shareRoutes.push({
        url: `${SITE_URL}/senator/${senator.senator_id}/share/province`,
        changeFrequency: 'yearly',
        priority: 0.4,
      });
    }
    if (candidateMunicipalitySwingHeadline(candidate, senator, yearA, yearB)) {
      shareRoutes.push({
        url: `${SITE_URL}/senator/${senator.senator_id}/share/map`,
        changeFrequency: 'yearly',
        priority: 0.4,
      });
    }
  }

  return [...staticRoutes, ...candidateRoutes, ...shareRoutes];
}
