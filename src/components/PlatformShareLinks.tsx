'use client';
import { useState } from 'react';
import { ChevronRight, Check, Link2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  /** Path (not absolute URL) to the page being shared, e.g. "/senator/go_bong/share/province". */
  url: string;
  title: string;
  /** Caption text for platforms whose share intent actually uses it (X does; Facebook's
   *  dialog re-scrapes OG tags and ignores any text passed to it). */
  xText: string;
  candidateId: string;
};

function absoluteUrl(path: string): string {
  return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
}

// Meta's officially documented, no-app_id share endpoint — confirmed via developers.facebook.com/docs/sharing/web.
function facebookShareHref(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

// X's officially documented web intent — confirmed to accept and prefill real text/URL.
function xShareHref(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

// fb-messenger://share is a widely-used mobile deep link, but it's NOT in Meta's official
// docs (their documented web-share dialog requires a registered app_id, which this project
// doesn't have) — treat this as best-effort on mobile only, never the only way to reach
// Messenger. The copy-link row below is the verified fallback if this silently does nothing.
function messengerDeepLink(url: string): string {
  return `fb-messenger://share?link=${encodeURIComponent(url)}`;
}

function isMobile(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function PlatformShareLinks({ url, title, xText, candidateId }: Props) {
  const [copied, setCopied] = useState(false);
  const shareUrl = absoluteUrl(url);
  const mobile = isMobile();

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    trackEvent('click_share', { candidate_id: candidateId, method: 'copy_link' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={facebookShareHref(shareUrl)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('click_share', { candidate_id: candidateId, method: 'platform_facebook' })}
        title={title}
        className="flex items-center gap-3 rounded-xl border bg-card p-3.5 hover:bg-accent transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: '#1877f2' }}>
          f
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Facebook</p>
          <p className="text-xs text-muted-foreground">Post to your timeline or a group</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </a>

      {mobile && (
        <a
          href={messengerDeepLink(shareUrl)}
          onClick={() => trackEvent('click_share', { candidate_id: candidateId, method: 'platform_messenger' })}
          title={title}
          className="flex items-center gap-3 rounded-xl border bg-card p-3.5 hover:bg-accent transition-colors"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: 'linear-gradient(135deg, #00b2ff, #a033ff, #ff5197)' }}
          >
            &#9993;
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Messenger</p>
            <p className="text-xs text-muted-foreground">Send directly to a chat</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </a>
      )}

      <a
        href={xShareHref(shareUrl, xText)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('click_share', { candidate_id: candidateId, method: 'platform_x' })}
        title={title}
        className="flex items-center gap-3 rounded-xl border bg-card p-3.5 hover:bg-accent transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0 border" style={{ background: '#000' }}>
          &#120143;
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">X</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{xText}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </a>

      {/* Always-visible fallback — covers Messenger on desktop (no verified web-share URL
          exists without an app_id) and any other channel (Viber, email, other chat apps). */}
      <button
        onClick={copyLink}
        className="flex items-center gap-3 rounded-xl border border-dashed bg-transparent p-3.5 hover:bg-accent transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{copied ? 'Link copied' : 'Copy link'}</p>
          <p className="text-xs text-muted-foreground">For Viber, email, or anywhere else</p>
        </div>
      </button>
    </div>
  );
}
