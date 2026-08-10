import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Raw dataset JSON (~44MB across years) — not content, shouldn't be crawled/indexed.
        '/data/',
        // Per-candidate static pages are being superseded by the query-string explorer URLs
        // (/?candidate=&year=) as the discoverable/indexed form — stop further crawling here
        // rather than fight two competing URL shapes for the same content.
        '/senator/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
