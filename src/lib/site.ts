// Falls back to the registered production domain — override with NEXT_PUBLIC_SITE_URL
// for previews/staging, everything else reads from here.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.botosenado.ph';
