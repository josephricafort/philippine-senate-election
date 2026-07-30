'use client';
import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  title: string;
  text: string;
  candidateId?: string;
  /** Absolute or root-relative URL to share — defaults to the current page (window.location.href).
   *  Share pages pass the interactive-explorer deep link (/?candidate=...) here so every share
   *  surface points back into the live map/profile rather than the static share-card page. */
  url?: string;
  /** Which surface this button lives on — distinguishes clicks on the static share-card pages
   *  from the senator profile's own share button in click_share analytics. */
  source?: 'profile_menu' | 'share_card_province' | 'share_card_map';
};

export default function ShareButton({ title, text, candidateId, url: urlProp, source }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = urlProp
      ? (urlProp.startsWith('http') ? urlProp : `${window.location.origin}${urlProp}`)
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        trackEvent('click_share', { candidate_id: candidateId ?? 'unknown', method: 'web_share', source: source ?? 'unknown' });
      } catch {
        // User cancelled the share sheet — no-op.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    trackEvent('click_share', { candidate_id: candidateId ?? 'unknown', method: 'copy_link', source: source ?? 'unknown' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
