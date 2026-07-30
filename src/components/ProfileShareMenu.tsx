'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  /** Root-relative deep link into the explorer, e.g. "/?candidate=tolentino_francis". */
  url: string;
  /** Composed caption text, already including the candidate name and "since {year}" clause
   *  (or without it, for a first-time candidate) — this component just appends the link. */
  text: string;
  candidateId: string;
};

// Facebook's share dialog re-scrapes OG tags and ignores any `quote`/text param for links it
// hasn't seen before, so it can't be forced to prefill a caption — passing text here is a
// documented no-op, not a bug. See PlatformShareLinks.tsx for that (OG-card) share flow, which
// this component intentionally does NOT reuse: this one is for a plain composed caption + link,
// with no preview card expected.
function facebookShareHref(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

// Unlike PlatformShareLinks' xShareHref, this intentionally includes `text` — that component
// omits it to preserve a rich link-card unfurl, but here no preview card is wanted at all, just
// the composed caption prefilled ready to post.
function xShareHref(url: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

// LinkedIn's share-offsite endpoint, like Facebook's, only accepts a URL and re-scrapes OG tags
// for the card — no text/caption param exists to prefill.
function linkedinShareHref(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export default function ProfileShareMenu({ url, text, candidateId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    trackEvent('click_share', { candidate_id: candidateId, method: 'copy_link', source: 'profile_menu' });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all shrink-0"
      >
        <Share2 className="w-3 h-3" />
        Share candidate
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 flex items-center gap-1.5 rounded-full border bg-card shadow-lg px-2.5 py-1.5 z-20">
          <a
            href={facebookShareHref(shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('click_share', { candidate_id: candidateId, method: 'platform_facebook', source: 'profile_menu' });
              setOpen(false);
            }}
            title="Share on Facebook"
            aria-label="Share on Facebook"
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 hover:opacity-90 active:scale-95 transition-all"
            style={{ background: '#1877f2' }}
          >
            f
          </a>

          <a
            href={xShareHref(shareUrl, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('click_share', { candidate_id: candidateId, method: 'platform_x', source: 'profile_menu' });
              setOpen(false);
            }}
            title="Share on X"
            aria-label="Share on X"
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 border hover:opacity-90 active:scale-95 transition-all"
            style={{ background: '#000' }}
          >
            &#120143;
          </a>

          <a
            href={linkedinShareHref(shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('click_share', { candidate_id: candidateId, method: 'platform_linkedin', source: 'profile_menu' });
              setOpen(false);
            }}
            title="Share on LinkedIn"
            aria-label="Share on LinkedIn"
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 hover:opacity-90 active:scale-95 transition-all"
            style={{ background: '#0a66c2' }}
          >
            in
          </a>

          <button
            onClick={copyLink}
            title="Copy link"
            aria-label="Copy link"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground shrink-0 hover:opacity-90 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
