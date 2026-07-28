'use client';
import { useSyncExternalStore, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

const CONSENT_KEY = 'analytics-consent';
type Consent = 'granted' | 'denied';

function readStoredConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

function applyConsent(consent: Consent) {
  window.gtag?.('consent', 'update', {
    analytics_storage: consent,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Consent Mode v2 gate for GA4. Defaults to denied (set inline in layout.tsx, before gtag.js
// ever loads) so no analytics cookies are set until the user actively opts in — this app can
// draw international traffic (EU/UK included) interested in Philippine election data.
const subscribeNoop = () => () => {};

export default function ConsentBanner() {
  // Lazy initializer runs once on the client during first render — window is guaranteed
  // available since this whole component only ever renders client-side ('use client').
  const [consent, setConsent] = useState<Consent | null>(() => readStoredConsent());
  // Hydration guard: server snapshot is always false (no localStorage during SSR), client
  // snapshot is always true — so the banner never flashes on the server-rendered markup
  // before hydration, without needing a setState-in-effect mount flag.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);

  function choose(value: Consent) {
    window.localStorage.setItem(CONSENT_KEY, value);
    applyConsent(value);
    setConsent(value);
  }

  if (!GA_ID) return null;

  return (
    <>
      {consent === 'granted' && <GoogleAnalytics gaId={GA_ID} />}

      {hydrated && consent === null && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur-sm px-4 py-3 flex flex-col sm:flex-row items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.25)]"
        >
          <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
            We use Google Analytics to understand how this site is used — no ads, no personal
            data collected. See our{' '}
            <a href="/methodology" className="underline hover:text-foreground">methodology page</a>.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => choose('denied')}
              className="px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-accent transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => choose('granted')}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
