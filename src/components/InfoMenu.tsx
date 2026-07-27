'use client';
import Link from 'next/link';
import { Menu, ExternalLink } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

const links = [
  { href: '/about', label: 'About' },
  { href: '/methodology', label: 'Data & methodology' },
];

// Falls back to a placeholder so the link is visibly non-functional in dev until the real
// form URL is set, rather than silently pointing at nothing.
const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || '#feedback-form-not-configured';

export default function InfoMenu() {
  return (
    <>
      {/* Desktop (md+): plain inline links, no dropdown needed */}
      <nav className="hidden md:flex items-center gap-4">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {l.label}
          </Link>
        ))}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Feedback &amp; bug reports
          <ExternalLink className="w-3 h-3" />
        </a>
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
              className="block rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Feedback &amp; bug reports
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </a>
        </PopoverContent>
      </Popover>
    </>
  );
}
