import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Raw dataset JSON (~44MB across years) — not content, shouldn't be crawled/indexed.
      disallow: '/data/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
