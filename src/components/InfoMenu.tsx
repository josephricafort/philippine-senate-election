'use client';
import Link from 'next/link';
import { Menu, ExternalLink, Info, FileText, MessageSquareWarning } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { trackEvent } from '@/lib/analytics';

const links = [
  { href: '/about', label: 'About', icon: Info },
  { href: '/methodology', label: 'Data & methodology', icon: FileText },
];

// Falls back to a placeholder so the link is visibly non-functional in dev until the real
// form URL is set, rather than silently pointing at nothing.
const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || '#feedback-form-not-configured';

export default function InfoMenu() {
  return (
    <>
      {/* Desktop (md+): plain inline links, no dropdown needed. Order here is Feedback, Data &
          methodology, About (About rightmost) — deliberately reversed from `links` (which stays
          About-first for mobile below) rather than reordering the shared array. */}
      <nav className="hidden md:flex items-center gap-4">
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('click_info_menu', { link_target: 'feedback' })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquareWarning className="w-3.5 h-3.5" />
          Feedback
          <ExternalLink className="w-3 h-3" />
        </a>
        <span className="w-px h-3.5 bg-border" aria-hidden="true" />
        {[...links].reverse().map(l => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => trackEvent('click_info_menu', { link_target: l.href })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <l.icon className="w-3.5 h-3.5" />
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Mobile: burger menu */}
      <Popover>
        <PopoverTrigger
          className="md:hidden inline-flex items-center justify-center rounded-lg border w-7 h-7 text-foreground hover:bg-accent transition-colors"
          title="Menu"
        >
          <Menu className="w-4 h-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1.5 md:hidden">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => trackEvent('click_info_menu', { link_target: l.href })}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <l.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              {l.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-border" aria-hidden="true" />
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('click_info_menu', { link_target: 'feedback' })}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <MessageSquareWarning className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1">Feedback</span>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </a>
        </PopoverContent>
      </Popover>
    </>
  );
}
