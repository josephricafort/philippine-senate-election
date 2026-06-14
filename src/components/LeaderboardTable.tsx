'use client';
import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VoteData, Senator, Metric } from '@/lib/types';

type SortKey = 'national_rank' | 'national_votes' | 'top_municipality';

type Props = {
  voteData: VoteData;
  senators: Senator[];
  highlightId: string | null;
  metric: Metric;
  onSelectSenator?: (senator: Senator) => void;
};

function topMuni(voteData: VoteData, senatorId: string, metric: Metric): { label: string; value: string } {
  let best = { name: '—', province: '', share: 0, votes: 0, rank: Infinity };
  for (const mun of Object.values(voteData.municipalities)) {
    const c = mun.candidates.find(c => c.senator_id === senatorId);
    if (!c) continue;
    if (c.vote_share > best.share) best = { name: mun.adm3_en, province: mun.adm2_en, share: c.vote_share, votes: c.votes, rank: c.rank };
  }
  const label = best.province ? `${best.name}, ${best.province}` : best.name;
  const value = metric === 'rank'
    ? `#${best.rank === Infinity ? '—' : best.rank}`
    : metric === 'vote_share'
      ? `${(best.share * 100).toFixed(1)}%`
      : formatVotes(best.votes);
  return { label, value };
}

function formatVotes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function SortIcon({ col, sortKey, asc }: { col: SortKey; sortKey: SortKey; asc: boolean }) {
  if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
  return asc
    ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
}

// Map metric → natural default sort column + direction
const METRIC_SORT: Record<Metric, { key: SortKey; asc: boolean }> = {
  rank:       { key: 'national_rank',  asc: true  },
  vote_share: { key: 'national_votes', asc: false },
  votes:      { key: 'national_votes', asc: false },
};

export default function LeaderboardTable({ voteData, senators, highlightId, metric, onSelectSenator }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(METRIC_SORT[metric].key);
  const [asc, setAsc] = useState(METRIC_SORT[metric].asc);
  const [highlightVisible, setHighlightVisible] = useState(true);
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When metric changes from the toolbar, reset sort to its natural default
  useEffect(() => {
    setSortKey(METRIC_SORT[metric].key);
    setAsc(METRIC_SORT[metric].asc);
  }, [metric]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc(a => !a);
    else { setSortKey(key); setAsc(key === 'national_rank'); }
  }

  const rows = senators
    .filter(s => voteData.national[s.senator_id])
    .map(s => ({
      senator: s,
      national: voteData.national[s.senator_id],
      top_muni: topMuni(voteData, s.senator_id, metric),
    }))
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === 'national_rank') diff = a.national.national_rank - b.national.national_rank;
      else if (sortKey === 'national_votes') diff = a.national.national_votes - b.national.national_votes;
      else diff = a.top_muni.label.localeCompare(b.top_muni.label);
      return asc ? diff : -diff;
    });

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

  const metricColLabel = metric === 'rank' ? 'Nat. rank' : metric === 'vote_share' ? 'Total votes' : 'Total votes';

  function renderMetricCell(row: typeof rows[0], isHighlight: boolean) {
    if (metric === 'rank') {
      return (
        <TableCell className="text-right">
          <Badge variant={isHighlight ? 'default' : 'secondary'}>
            #{row.national.national_rank}
          </Badge>
        </TableCell>
      );
    }
    if (metric === 'vote_share') {
      // Show national vote share (senator's total votes / all votes cast that year)
      const totalAllVotes = Object.values(voteData.municipalities).reduce(
        (sum, mun) => sum + mun.candidates.reduce((s, c) => s + c.votes, 0), 0
      );
      const share = totalAllVotes > 0 ? row.national.national_votes / totalAllVotes : 0;
      return (
        <TableCell className="text-right tabular-nums text-sm font-medium">
          {(share * 100).toFixed(2)}%
        </TableCell>
      );
    }
    return (
      <TableCell className="text-right tabular-nums text-sm font-medium">
        {formatVotes(row.national.national_votes)}
      </TableCell>
    );
  }

  function renderRow(row: typeof rows[0], ref?: React.Ref<HTMLTableRowElement>) {
    const isHighlight = row.senator.senator_id === highlightId;
    return (
      <TableRow
        key={row.senator.senator_id}
        ref={ref}
        className={isHighlight ? 'bg-primary/8 border-l-2 border-l-primary' : ''}
      >
        <TableCell className={`font-medium ${isHighlight ? 'text-primary' : ''}`}>
          {onSelectSenator ? (
            <button
              className="text-left hover:underline underline-offset-2 cursor-pointer"
              onClick={() => onSelectSenator(row.senator)}
            >
              {row.senator.senator_name}
            </button>
          ) : (
            row.senator.senator_name
          )}
        </TableCell>
        {renderMetricCell(row, isHighlight)}
        <TableCell className="text-muted-foreground text-sm">
          <span>{row.top_muni.label}</span>
          <span className="ml-2 tabular-nums text-foreground font-medium">{row.top_muni.value}</span>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => toggleSort('national_rank')}>
                {metricColLabel} <SortIcon col="national_rank" sortKey={sortKey} asc={asc} />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium" onClick={() => toggleSort('top_municipality')}>
                Top municipality <SortIcon col="top_municipality" sortKey={sortKey} asc={asc} />
              </Button>
            </TableHead>
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
