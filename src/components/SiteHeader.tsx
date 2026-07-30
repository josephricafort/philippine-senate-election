import Link from 'next/link';
import { Vote } from 'lucide-react';
import InfoMenu from '@/components/InfoMenu';

type Props = {
  /** Extra content rendered before InfoMenu in the right-hand group — currently only the
   *  explorer's own "Loading data…" indicator, which no static page needs. */
  rightExtra?: React.ReactNode;
};

// Shared top bar for every page — the interactive explorer and every static page (About, Data
// & methodology, and the two social-share pages) all render this exact same header, so the
// logo/title/menu stay one consistent, recognizable strip no matter where a link lands someone.
// A server component (no 'use client') so it can be used from async server pages directly;
// InfoMenu is its own client component underneath, which is fine to nest either way.
export default function SiteHeader({ rightExtra }: Props) {
  return (
    <header className="shrink-0 border-b px-4 md:px-6 py-3 flex items-center gap-4">
      <Link href="/" className="flex items-center gap-2.5">
        <Vote className="w-6 h-6 text-primary shrink-0" strokeWidth={2} />
        <div>
          <h1 className="text-base font-semibold leading-tight">
            BotoSenado
          </h1>
          <p className="text-xs text-muted-foreground">Philippine Senate Election Results (2007 - 2025)</p>
        </div>
      </Link>
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        {rightExtra}
        <InfoMenu />
      </div>
    </header>
  );
}
