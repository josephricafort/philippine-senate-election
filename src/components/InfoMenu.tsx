'use client';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

const links = [
  { href: '/about', label: 'About' },
  { href: '/methodology', label: 'Data & methodology' },
];

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
        </PopoverContent>
      </Popover>
    </>
  );
}
