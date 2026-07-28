import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import candidateIndex from '../public/data/candidate_index.json';

// Some share targets (SMS, notes apps, chat clients without native share support)
// concatenate navigator.share()'s title/text/url into a single string before the
// recipient opens it — e.g. "/senator/go_bong Go, Bong's senate voting results, ...".
// Recover the real candidate slug from the mangled path instead of 404ing.
const validSlugs = new Set(candidateIndex.map((e: { senator_id: string }) => e.senator_id));

export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/senator\/([^/]+)$/);
  if (!match) return NextResponse.next();

  const rawSlug = decodeURIComponent(match[1]);
  if (validSlugs.has(rawSlug)) return NextResponse.next();

  // Try to recover a valid slug from the start of the mangled string — candidate
  // slugs are lowercase snake_case, so the first run of [a-z0-9_] is the real slug.
  const recovered = rawSlug.match(/^[a-z0-9_]+/)?.[0];
  if (recovered && validSlugs.has(recovered)) {
    const url = request.nextUrl.clone();
    url.pathname = `/senator/${recovered}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/senator/:slug*',
};
