// Falls back to the registered production domain — override with NEXT_PUBLIC_SITE_URL
// for previews/staging, everything else reads from here.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.botosenado.ph';

// For request-time contexts (generateMetadata, Route Handlers) that need an absolute origin
// matching whatever domain the request actually arrived on — SITE_URL alone would point OG
// image/URL metadata at the production domain even when served from a preview/staging deploy
// (e.g. Vercel's *.vercel.app URL while the production domain is temporarily offline pre-launch).
// forwarded proto/host are what Vercel's edge sets for the original request; x-forwarded-host
// wins over Host since some proxies rewrite Host to an internal value.
export function siteUrlFromHeaders(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return SITE_URL;
  const proto = headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}
