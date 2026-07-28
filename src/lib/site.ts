// Falls back to a placeholder until a production domain is registered — swap
// NEXT_PUBLIC_SITE_URL once one exists, everything else reads from here.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://botosenado.ph';
