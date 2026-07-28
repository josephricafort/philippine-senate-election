'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { NationalYearData, Senator } from '@/lib/types';

type Props = {
  nationalData: NationalYearData;
  senators: Senator[];
  highlightId: string | null;
  onSelectSenator?: (senator: Senator) => void;
};

// Gold / silver / bronze for the top 3 national ranks — everyone else keeps the plain badge
const MEDAL_STYLES: Record<number, { background: string; color: string }> = {
  1: { background: '#fdf3d8', color: '#b8860b' },
  2: { background: '#eef1f3', color: '#78808c' },
  3: { background: '#fbe9dc', color: '#a6591f' },
};

// National rank, independent of the Rank/Vote share/Raw votes metric used
// by the Profile and Map columns — the leaderboard always ranks everyone nationally.
export default function LeaderboardTable({ nationalData, senators, highlightId, onSelectSenator }: Props) {
  const [highlightVisible, setHighlightVisible] = useState(true);
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  function renderRow(row: typeof rows[0], ref?: React.Ref<HTMLTableRowElement>) {
    const isHighlight = row.senator.senator_id === highlightId;
    return (
      <TableRow
        key={row.senator.senator_id}
        ref={ref}
        onClick={onSelectSenator ? () => onSelectSenator(row.senator) : undefined}
        className={[
          isHighlight ? 'bg-primary/8 border-l-2 border-l-primary' : '',
          onSelectSenator ? 'cursor-pointer hover:bg-accent/50' : '',
        ].join(' ')}
      >
        <TableCell>
          <Badge
            variant={isHighlight ? 'default' : 'secondary'}
            style={!isHighlight ? MEDAL_STYLES[row.national.national_rank] : undefined}
          >
            #{row.national.national_rank}
          </Badge>
        </TableCell>
        <TableCell className={`font-medium ${isHighlight ? 'text-primary' : ''}`}>
          {row.senator.senator_name}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      {/* containerClassName overrides Table's default overflow-x-auto wrapper — that wrapper
          is itself a scroll container, which breaks `sticky` on the header below because it
          sits between the header and the actual scrolling ancestor (this div). */}
      <Table containerClassName="overflow-visible">
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Nat. rank</TableHead>
            <TableHead>Candidate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row =>
            row.senator.senator_id === highlightId
              ? renderRow(row, highlightRef)
              : renderRow(row)
          )}
        </TableBody>
      </Table>

      {/* Sticky pinned row — shown only when highlight row is scrolled out of view */}
      {highlightRow && !highlightVisible && (
        <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-20">
          <Table>
            <TableBody>
              {renderRow(highlightRow)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
