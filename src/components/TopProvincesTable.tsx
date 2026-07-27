'use client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Metric } from '@/lib/types';

type Row = {
  adm2_en: string;
  votes: number;
  vote_share: number;
  rank: number;
};

type Props = { rows: Row[]; metric: Metric; year: number };

function formatVotes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function TopProvincesTable({ rows, metric, year }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold mb-3.5">Top provinces &middot; {year}</p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm py-2">No data</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Province</TableHead>
              <TableHead className="text-xs text-right">Share</TableHead>
              <TableHead className="text-xs text-right">{metric === 'votes' ? 'Votes' : 'Rank'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.adm2_en}>
                <TableCell className="py-1.5 text-sm truncate max-w-32">{row.adm2_en}</TableCell>
                <TableCell className="py-1.5 text-right text-sm font-medium tabular-nums whitespace-nowrap">
                  {(row.vote_share * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  {metric === 'votes' ? (
                    <span className="text-sm font-medium tabular-nums">{formatVotes(row.votes)}</span>
                  ) : (
                    <Badge variant="outline" className="text-xs tabular-nums">#{row.rank}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
