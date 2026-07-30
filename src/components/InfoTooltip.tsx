'use client';
import Link from 'next/link';
import { Info } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// Shared disclaimer for any rank/count figure that's derived from our own compiled
// dataset rather than an authoritative COMELEC feed — see the methodology page for why.
export function RankDisclaimerTooltip({ className }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={className}
          aria-label="Rank and count disclaimer"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          May deviate from Comelec&apos;s official rank/count. See disclaimer under{' '}
          <Link href="/methodology#disclaimer" className="underline underline-offset-2">
            Data and methodology
          </Link>
          .
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
