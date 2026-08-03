'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RankDisclaimerTooltip } from '@/components/InfoTooltip';
import CandidateAvatar from '@/components/CandidateAvatar';
import { LEADERBOARD_MEDAL_STYLES, leaderboardYearColors } from '@/lib/leaderboard-colors';
import type { NationalYearData, Senator } from '@/lib/types';

type Props = {
  nationalData: NationalYearData;
  senators: Senator[];
  highlightId: string | null;
  year: number;
  onSelectSenator?: (senator: Senator) => void;
};

// National rank, independent of the Rank/Vote share/Raw votes metric used
// by the Profile and Map columns — the leaderboard always ranks everyone nationally.
export default function LeaderboardTable({ nationalData, senators, highlightId, year, onSelectSenator }: Props) {
  const [highlightVisibility, setHighlightVisibility] = useState<{ highlightId: string | null; visible: boolean }>({
    highlightId: null,
    visible: true,
  });
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    highlightBackground,
    highlightBorder,
    highlightBadgeBackground,
    defaultAvatarColor,
    highlightAvatarColor,
  } = leaderboardYearColors(year);

  const rows = useMemo(() => (
    senators
      .filter(s => nationalData[s.senator_id])
      .map(s => ({
        senator: s,
        national: nationalData[s.senator_id],
      }))
      .sort((a, b) => a.national.national_rank - b.national.national_rank)
  ), [nationalData, senators]);

  const highlightRow = highlightId ? rows.find(r => r.senator.senator_id === highlightId) : null;
  const highlightVisible = highlightVisibility.highlightId === highlightId ? highlightVisibility.visible : true;

  // Track whether the highlighted row is visible in the scroll container
  useEffect(() => {
    const container = scrollRef.current;
    const row = highlightRef.current;
    if (!container || !row || !highlightId) {
      setHighlightVisibility({ highlightId, visible: true });
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setHighlightVisibility({ highlightId, visible: entry.isIntersecting }),
      { root: container, threshold: 0.5 }
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [highlightId, rows]);

  function renderRow(row: typeof rows[0]) {
    const isHighlight = row.senator.senator_id === highlightId;
    return (
      <TableRow
        key={row.senator.senator_id}
        ref={isHighlight ? highlightRef : undefined}
        onClick={onSelectSenator ? () => onSelectSenator(row.senator) : undefined}
        style={isHighlight ? {
          backgroundColor: highlightBackground,
          borderLeftWidth: '2px',
          borderLeftStyle: 'solid',
          borderLeftColor: highlightBorder,
        } : undefined}
        className={[
          isHighlight ? 'hover:bg-transparent' : '',
          onSelectSenator ? 'cursor-pointer hover:bg-accent/50' : '',
        ].join(' ')}
      >
        <TableCell className="w-16">
          <Badge
            variant={isHighlight ? 'default' : 'secondary'}
            style={isHighlight
              ? {
                  backgroundColor: highlightBadgeBackground,
                  color: '#ffffff',
                  border: `1px solid ${highlightBorder}`,
                }
              : LEADERBOARD_MEDAL_STYLES[row.national.national_rank]}
          >
            #{row.national.national_rank}
          </Badge>
        </TableCell>
        <TableCell className="w-full max-w-0 font-medium">
          <div className="flex items-center gap-2 min-w-0">
            <CandidateAvatar
              senatorId={row.senator.senator_id}
              senatorName={row.senator.senator_name}
              active={isHighlight}
              className="w-7 h-7 text-xs"
              fallbackBackgroundColor={isHighlight ? highlightAvatarColor : defaultAvatarColor}
              fallbackTextColor={isHighlight ? '#111827' : '#ffffff'}
            />
            <span className="truncate">{row.senator.senator_name}</span>
          </div>
        </TableCell>
        <TableCell className="w-12 text-muted-foreground">
          {row.senator.years.length}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      {/* containerClassName overrides Table's default overflow-x-auto wrapper — that wrapper
          is itself a scroll container, which breaks `sticky` on the header below because it
          sits between the header and the actual scrolling ancestor (this div). */}
      <Table containerClassName="overflow-visible" className="table-fixed">
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-16 whitespace-normal">
              <span className="inline-flex items-center gap-1">
                Rank
                <RankDisclaimerTooltip />
              </span>
            </TableHead>
            <TableHead>Candidate</TableHead>
            <TableHead className="w-12">Runs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => renderRow(row))}
        </TableBody>
      </Table>

      {/* Sticky pinned row — shown only when highlight row is scrolled out of view */}
      {highlightRow && !highlightVisible && (
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-20">
          <Table className="table-fixed">
            <TableBody>
              {renderRow(highlightRow)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
