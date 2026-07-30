'use client';
import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  /** Root-relative deep link into the explorer, e.g. "/?candidate=tolentino_francis". */
  url: string;
  /** Composed caption text, already including the candidate name and "since {year}" clause
   *  (or without it, for a first-time candidate) — this component just appends the link. */
  text: string;
  candidateId: string;
  /** Button label — defaults to "Share". */
  label?: string;
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

export default function ProfileShareMenu({ url, text, candidateId, label = 'Share' }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 hover:opacity-90 active:scale-95 transition-all shrink-0"
      >
        <Share2 className="w-3 h-3" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-lg overflow-hidden z-20">
          <a
            href={facebookShareHref(shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('click_share', { candidate_id: candidateId, method: 'platform_facebook' });
              setOpen(false);
            }}
            className="flex items-center gap-3 px-3.5 py-3 hover:bg-accent transition-colors"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: '#1877f2' }}>
              f
            </div>
            <span className="text-sm font-medium">Facebook</span>
          </a>

          <a
            href={xShareHref(shareUrl, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackEvent('click_share', { candidate_id: candidateId, method: 'platform_x' });
              setOpen(false);
            }}
            className="flex items-center gap-3 px-3.5 py-3 hover:bg-accent transition-colors border-t"
          >
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0 border" style={{ background: '#000' }}>
              &#120143;
            </div>
            <span className="text-sm font-medium">X</span>
          </a>
        </div>
      )}
    </div>
  );
}
