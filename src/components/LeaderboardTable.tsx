'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RankDisclaimerTooltip } from '@/components/InfoTooltip';
import CandidateAvatar from '@/components/CandidateAvatar';
import { yearColor } from '@/lib/year-colors';
import type { NationalYearData, Senator } from '@/lib/types';

type Props = {
  nationalData: NationalYearData;
  senators: Senator[];
  highlightId: string | null;
  year: number;
  onSelectSenator?: (senator: Senator) => void;
};

// Gold / silver / bronze for the top 3 national ranks — everyone else keeps the plain badge
const MEDAL_STYLES: Record<number, { background: string; color: string }> = {
  1: { background: '#fdf3d8', color: '#b8860b' },
  2: { background: '#eef1f3', color: '#78808c' },
  3: { background: '#fbe9dc', color: '#a6591f' },
};

function mixHexColors(colorA: string, colorB: string, weightB: number) {
  const a = colorA.replace('#', '');
  const b = colorB.replace('#', '');
  if (a.length !== 6 || b.length !== 6) return colorA;

  const weightA = 1 - weightB;
  const mixed = [0, 2, 4].map(offset => {
    const channelA = parseInt(a.slice(offset, offset + 2), 16);
    const channelB = parseInt(b.slice(offset, offset + 2), 16);
    const value = Math.round(channelA * weightA + channelB * weightB);
    return value.toString(16).padStart(2, '0');
  }).join('');

  return `#${mixed}`;
}

// National rank, independent of the Rank/Vote share/Raw votes metric used
// by the Profile and Map columns — the leaderboard always ranks everyone nationally.
export default function LeaderboardTable({ nationalData, senators, highlightId, year, onSelectSenator }: Props) {
  const [highlightVisible, setHighlightVisible] = useState(true);
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeYearColor = yearColor(year);
  const highlightBackground = mixHexColors(activeYearColor, '#18181b', 0.86);
  const highlightBorder = mixHexColors(activeYearColor, '#f4f4f5', 0.24);
  const highlightBadgeBackground = mixHexColors(activeYearColor, '#27272a', 0.48);
  const defaultAvatarColor = mixHexColors(activeYearColor, '#52525b', 0.62);
  const highlightAvatarColor = mixHexColors(activeYearColor, '#f4f4f5', 0.72);

  const rows = senators
    .filter(s => nationalData[s.senator_id])
    .map(s => ({
      senator: s,
      national: nationalData[s.senator_id],
    }))
    .sort((a, b) => a.national.national_rank - b.national.national_rank);

  const highlightRow = highlightId ? rows.find(r => r.senator.senator_id === highlightId) : null;

  // Track whether the highlighted row is visible in the scroll container
  useEffect(() => {
    const container = scrollRef.current;
    const row = highlightRef.current;
    if (!container || !row || !highlightId) { setHighlightVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => setHighlightVisible(entry.isIntersecting),
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
              : MEDAL_STYLES[row.national.national_rank]}
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
                Nat. rank
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
