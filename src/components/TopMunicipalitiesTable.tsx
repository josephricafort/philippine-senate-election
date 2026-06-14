'use client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type Row = {
  psgc: string;
  adm3_en: string;
  adm2_en: string;
  votes: number;
  vote_share: number;
  rank: number;
};

type Props = { rows: Row[] };

export default function TopMunicipalitiesTable({ rows }: Props) {
  if (rows.length === 0) return (
    <p className="text-muted-foreground text-sm py-2">No data</p>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Municipality</TableHead>
          <TableHead className="text-xs">Province</TableHead>
          <TableHead className="text-xs text-right">Share</TableHead>
          <TableHead className="text-xs text-right">Rank</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.psgc}>
            <TableCell className="py-1.5 text-sm truncate max-w-32">{row.adm3_en}</TableCell>
            <TableCell className="py-1.5 text-sm text-muted-foreground truncate max-w-32">{row.adm2_en}</TableCell>
            <TableCell className="py-1.5 text-right text-sm font-medium tabular-nums whitespace-nowrap">
              {(row.vote_share * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="py-1.5 text-right">
              <Badge variant="outline" className="text-xs tabular-nums">#{row.rank}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
