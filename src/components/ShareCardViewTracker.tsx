'use client';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  candidateId: string;
  cardType: 'province_swing' | 'map_swing' | 'top_provinces';
  yearA: number;
  // top_provinces has only one year (no swing pair to compare) — omitted for it.
  yearB?: number;
};

// Fires once per mount — the share/province and share/map pages are server components (needed
// for generateStaticParams/generateMetadata), so this is the client-side island that reports a
// real visitor actually opened a shared card, distinct from bots/crawlers hitting og-image alone.
export default function ShareCardViewTracker({ candidateId, cardType, yearA, yearB }: Props) {
  useEffect(() => {
    trackEvent('view_share_card', { candidate_id: candidateId, card_type: cardType, year_a: yearA, year_b: yearB });
  }, [candidateId, cardType, yearA, yearB]);

  return null;
}
