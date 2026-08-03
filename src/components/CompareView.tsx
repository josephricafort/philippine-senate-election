'use client';

import { type CSSProperties, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronsUpDown, Fingerprint, MapPinned, Trophy } from 'lucide-react';
import Link from 'next/link';

import CandidateAvatar from '@/components/CandidateAvatar';
import Spinner from '@/components/Spinner';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { headlineName } from '@/lib/display-name';
import { cn } from '@/lib/utils';
import { yearColor } from '@/lib/year-colors';
import type { NationalYearData, Senator, VoteData } from '@/lib/types';

type Scope = 'national' | 'provincial';

type RankRow = {
  senator_id: string;
  senator_name: string;
  rank: number;
  vote_share: number;
  votes: number;
};

type SelectOption = {
  value: string;
  label: string;
};

type CandidateOption = {
  senator_id: string;
  senator_name: string;
};

type CandidateProvinceProfile = {
  senator_id: string;
  senator_name: string;
  vector: number[];
  rankedShares: { province: string; vote_share: number }[];
};

type SimilarityRow = {
  senator_id: string;
  senator_name: string;
  score: number;
};

type StrongholdEntry = {
  province: string;
  leftRank?: number;
  rightRank?: number;
  sortRank: number;
};

type Props = {
  selectedSenator: Senator;
  senators: Senator[];
  nationalData: NationalYearData;
  voteData: VoteData | null;
  year: number;
};

const TOP_ROW_COUNT = 7;
const ALL_MUNICIPALITIES = '__all__';
const DEFAULT_SIMILARITY_COUNT = 3;
const STRONGHOLD_PREVIEW_COUNT = 3;
const STRONGHOLD_LIST_COUNT = 30;
const STRONGHOLD_LEFT_COLOR = '#71717a';
const STRONGHOLD_RIGHT_COLOR = '#a1a1aa';

function toRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function mixColors(hexA: string, hexB: string, weightA: number) {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  if (!a || !b) return hexA;

  const weightB = 1 - weightA;
  const r = Math.round(a.r * weightA + b.r * weightB);
  const g = Math.round(a.g * weightA + b.g * weightB);
  const bChannel = Math.round(a.b * weightA + b.b * weightB);

  return `rgb(${r}, ${g}, ${bChannel})`;
}

function formatShare(share: number) {
  return `${(share * 100).toFixed(2)}%`;
}

function averageComparisonDelta(voteShare: number, fieldSize: number) {
  if (fieldSize <= 0) return 0;
  const averageShare = 1 / fieldSize;
  return voteShare - averageShare;
}

function formatAverageComparison(delta: number) {
  const value = Math.abs(delta * 100).toFixed(1);
  const sign = Number(value) === 0 ? '' : delta > 0 ? '+' : '−';
  return `${sign}${value}pt`;
}

function formatSimilarity(score: number) {
  return score.toFixed(2);
}

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

function alphaColor(hex: string, alpha: number) {
  const rgb = toRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function formatPartitionLabel(value: number, total: number) {
  if (value <= 0 || total <= 0) return '';
  return `${value} (${Math.round((value / total) * 100)}%)`;
}

function formatPartitionLegend(label: string, value: number, total: number) {
  return `${label} - ${formatPartitionLabel(value, total)}`;
}

function strongholdOverlapAssessment(sharedCount: number) {
  if (sharedCount >= 21) {
    return 'This suggests strong overlap in where both candidates were strongest.';
  }

  if (sharedCount >= 11) {
    return 'This suggests a fair amount of overlap in where both candidates were strongest.';
  }

  return 'This suggests only weak overlap in where both candidates were strongest.';
}

function getCandidateName(nameById: Map<string, string>, senatorId: string) {
  return nameById.get(senatorId) ?? senatorId;
}

function surnameLabel(storedName: string) {
  return storedName.split(',')[0]?.trim().toUpperCase() ?? storedName.toUpperCase();
}

function shortCandidateName(storedName: string) {
  const commaIndex = storedName.indexOf(',');
  if (commaIndex === -1) return storedName;

  const last = storedName.slice(0, commaIndex).trim();
  const rest = storedName.slice(commaIndex + 1)
    .replace(/\(.*?\)/g, '')
    .replace(/\b(Jr\.?|Sr\.?|III|II|IV)\b/gi, '')
    .trim();
  const firstInitial = rest[0]?.toUpperCase();

  return firstInitial ? `${last}, ${firstInitial}.` : last;
}

function pearsonCorrelation(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;

  let numerator = 0;
  let sumSqA = 0;
  let sumSqB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const deltaA = a[i] - meanA;
    const deltaB = b[i] - meanB;
    numerator += deltaA * deltaB;
    sumSqA += deltaA * deltaA;
    sumSqB += deltaB * deltaB;
  }

  if (sumSqA === 0 || sumSqB === 0) return 0;
  return numerator / Math.sqrt(sumSqA * sumSqB);
}

function buildNationalRows(nationalData: NationalYearData, nameById: Map<string, string>): RankRow[] {
  const totalVotes = Object.values(nationalData).reduce((sum, row) => sum + row.national_votes, 0);

  return Object.entries(nationalData)
    .map(([senator_id, row]) => ({
      senator_id,
      senator_name: getCandidateName(nameById, senator_id),
      rank: row.national_rank,
      vote_share: totalVotes > 0 ? row.national_votes / totalVotes : 0,
      votes: row.national_votes,
    }))
    .sort((a, b) => a.rank - b.rank || b.votes - a.votes || a.senator_name.localeCompare(b.senator_name));
}

function buildProvinceRows(voteData: VoteData, province: string, nameById: Map<string, string>): RankRow[] {
  const totals = new Map<string, number>();
  let totalVotes = 0;

  for (const municipality of Object.values(voteData.municipalities)) {
    if (municipality.adm2_en !== province) continue;
    for (const candidate of municipality.candidates) {
      totals.set(candidate.senator_id, (totals.get(candidate.senator_id) ?? 0) + candidate.votes);
      totalVotes += candidate.votes;
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([senator_id, votes]) => ({
      senator_id,
      senator_name: getCandidateName(nameById, senator_id),
      votes,
    }))
    .sort((a, b) => b.votes - a.votes || a.senator_name.localeCompare(b.senator_name));

  let currentRank = 0;
  let previousVotes: number | null = null;

  return sorted.map((row, index) => {
    if (previousVotes === null || row.votes !== previousVotes) {
      currentRank = index + 1;
      previousVotes = row.votes;
    }

    return {
      ...row,
      rank: currentRank,
      vote_share: totalVotes > 0 ? row.votes / totalVotes : 0,
    };
  });
}

function buildMunicipalityRows(voteData: VoteData, psgc: string, nameById: Map<string, string>): RankRow[] {
  const municipality = voteData.municipalities[psgc];
  if (!municipality) return [];

  return municipality.candidates
    .map(candidate => ({
      senator_id: candidate.senator_id,
      senator_name: getCandidateName(nameById, candidate.senator_id),
      rank: candidate.rank,
      vote_share: candidate.vote_share,
      votes: candidate.votes,
    }))
    .sort((a, b) => a.rank - b.rank || b.votes - a.votes || a.senator_name.localeCompare(b.senator_name));
}

function CompareCombobox({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(option => option.value === value)?.label ?? placeholder;

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem key={option.value} value={option.label} onSelect={() => select(option.value)}>
                  <Check className={cn('mr-2 h-4 w-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CandidateCombobox({
  value,
  options,
  onChange,
  avatarFallbackColor,
  className,
  stackOnMobile,
}: {
  value: CandidateOption;
  options: CandidateOption[];
  onChange: (value: string) => void;
  avatarFallbackColor: string;
  className?: string;
  stackOnMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border bg-card px-4 py-4 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background',
          stackOnMobile && 'relative min-h-[8.5rem] justify-center xl:min-h-0 xl:justify-between',
          className
        )}
      >
        <div className={cn(
          'flex min-w-0 items-center gap-3',
          stackOnMobile && 'flex-col gap-2 text-center xl:flex-row xl:text-left'
        )}>
          <CandidateAvatar
            senatorId={value.senator_id}
            senatorName={value.senator_name}
            active={false}
            className="w-12 h-12 text-base"
            fallbackBackgroundColor={avatarFallbackColor}
            fallbackTextColor="#ffffff"
          />
          <span className={cn(
            'text-sm font-semibold',
            stackOnMobile
              ? 'max-w-full whitespace-normal text-center leading-tight xl:truncate xl:text-left'
              : 'truncate text-left'
          )}>
            {value.senator_name}
          </span>
        </div>
        <ChevronsUpDown className={cn(
          'h-4 w-4 shrink-0 opacity-50',
          stackOnMobile && 'absolute right-4 top-4 xl:static'
        )} />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search candidate..." />
          <CommandList>
            <CommandEmpty>No candidates found.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.senator_id}
                  value={option.senator_name}
                  onSelect={() => select(option.senator_id)}
                >
                  <Check className={cn('mr-2 h-4 w-4', option.senator_id === value.senator_id ? 'opacity-100' : 'opacity-0')} />
                  <CandidateAvatar
                    senatorId={option.senator_id}
                    senatorName={option.senator_name}
                    active={false}
                    className="w-7 h-7 text-xs"
                    fallbackBackgroundColor={avatarFallbackColor}
                    fallbackTextColor="#ffffff"
                  />
                  <span className="truncate">{option.senator_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (scope: Scope) => void;
}) {
  return (
    <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-muted p-1">
      <button
        type="button"
        onClick={() => onChange('national')}
        className={`h-8 px-3.5 text-sm font-medium rounded-md transition-colors ${
          scope === 'national'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        National
      </button>
      <button
        type="button"
        onClick={() => onChange('provincial')}
        className={`h-8 px-3.5 text-sm font-medium rounded-md transition-colors ${
          scope === 'provincial'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Provincial
      </button>
    </div>
  );
}

function RankTable({
  rows,
  selectedSenatorId,
  avatarFallbackColor,
}: {
  rows: RankRow[];
  selectedSenatorId: string;
  avatarFallbackColor: string;
}) {
  const selectedRow = rows.find(row => row.senator_id === selectedSenatorId) ?? null;
  const topRows = rows.slice(0, TOP_ROW_COUNT);
  const selectedInTop = topRows.some(row => row.senator_id === selectedSenatorId);
  const visibleRows = selectedRow && !selectedInTop ? [...topRows, selectedRow] : topRows;

  return (
    <div className="rounded-xl border bg-card p-4">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-full text-xs">Candidate</TableHead>
            <TableHead className="w-[4.1rem] px-1 text-xs text-right xl:w-24 xl:px-2">Vote share</TableHead>
            <TableHead className="w-[4.35rem] px-1 text-xs text-right xl:w-24 xl:px-2">Gap from Avg</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row, index) => {
            const isSelected = row.senator_id === selectedSenatorId;
            const isAppended = isSelected && !selectedInTop && index === visibleRows.length - 1;

            return (
              <TableRow
                key={`${row.senator_id}-${isAppended ? 'selected' : 'rank'}`}
                className={cn(
                  isSelected && 'bg-accent/60 hover:bg-accent/60',
                  isAppended && 'border-t-2'
                )}
              >
                <TableCell className={cn('w-full max-w-0 py-1.5 pr-2', isSelected && 'border-l-2 border-l-primary pl-1.5')}>
                  <div className="flex min-w-0 items-center gap-2 xl:gap-2.5">
                    <span className="w-5 shrink-0 text-sm text-muted-foreground">{row.rank}</span>
                    <CandidateAvatar
                      senatorId={row.senator_id}
                      senatorName={row.senator_name}
                      active={isSelected}
                      className="h-9 w-9 text-xs xl:h-10 xl:w-10 xl:text-sm"
                      fallbackBackgroundColor={avatarFallbackColor}
                      fallbackTextColor="#ffffff"
                    />
                    <Link
                      href={`/?candidate=${row.senator_id}`}
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-medium hover:text-primary transition-colors',
                        isSelected && 'font-bold text-primary'
                      )}
                    >
                      {shortCandidateName(row.senator_name)}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="w-[4.1rem] py-1.5 px-1 text-right text-xs font-semibold xl:w-24 xl:px-2 xl:text-sm">
                  {formatShare(row.vote_share)}
                </TableCell>
                {(() => {
                  const averageDelta = averageComparisonDelta(row.vote_share, rows.length);
                  return (
                    <TableCell
                      className={cn(
                        'w-[4.35rem] py-1.5 px-1 text-right text-xs font-semibold xl:w-24 xl:px-2 xl:text-sm',
                        averageDelta > 0 && 'text-emerald-400',
                        averageDelta < 0 && 'text-rose-400',
                        averageDelta === 0 && 'text-foreground'
                      )}
                    >
                      {formatAverageComparison(averageDelta)}
                    </TableCell>
                  );
                })()}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CandidateCard({
  senatorId,
  senatorName,
  className,
  avatarFallbackColor,
  fullName,
  stackOnMobile,
}: {
  senatorId: string;
  senatorName: string;
  className?: string;
  avatarFallbackColor: string;
  fullName?: boolean;
  stackOnMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card px-4 py-4',
        stackOnMobile && 'flex items-center justify-center xl:block',
        className
      )}
    >
      <Link
        href={`/?candidate=${senatorId}`}
        className={cn(
          'flex w-full items-center gap-3 hover:text-primary transition-colors',
          stackOnMobile && 'justify-center flex-col items-center gap-2 text-center xl:flex-row xl:justify-start xl:text-left'
        )}
      >
        <CandidateAvatar
          senatorId={senatorId}
          senatorName={senatorName}
          active={false}
          className="w-12 h-12 text-base"
          fallbackBackgroundColor={avatarFallbackColor}
          fallbackTextColor="#ffffff"
        />
        <span className={cn(
          fullName ? 'text-base md:text-lg' : 'text-sm',
          stackOnMobile
            ? 'max-w-full whitespace-normal text-center font-semibold leading-tight xl:min-w-0 xl:flex-1 xl:truncate xl:text-left'
            : 'min-w-0 flex-1 truncate font-semibold'
        )}>
          {fullName ? senatorName : shortCandidateName(senatorName)}
        </span>
      </Link>
    </div>
  );
}

function SimilarityColumn({
  title,
  tone,
  rows,
  avatarFallbackColor,
}: {
  title: string;
  tone: 'similar' | 'opposite';
  rows: SimilarityRow[];
  avatarFallbackColor: string;
}) {
  const textTone = tone === 'similar' ? 'text-emerald-400' : 'text-rose-400';
  const dotTone = tone === 'similar' ? 'bg-emerald-400' : 'bg-rose-400';

  return (
    <div className="space-y-2.5">
      <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', textTone)}>
        <span className={cn('h-2.5 w-2.5 rounded-full', dotTone)} />
        {title}
      </div>
      <div className="space-y-2">
        {rows.map(row => (
          <Link
            key={row.senator_id}
            href={`/?candidate=${row.senator_id}`}
            className="flex items-center gap-2.5 rounded-xl border bg-card px-2.5 py-3 hover:bg-accent transition-colors"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <CandidateAvatar
                senatorId={row.senator_id}
                senatorName={row.senator_name}
                active={false}
                className="w-10 h-10 text-sm"
                fallbackBackgroundColor={avatarFallbackColor}
                fallbackTextColor="#ffffff"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{shortCandidateName(row.senator_name)}</span>
                <span className={cn('mt-0.5 block text-left text-sm font-semibold tabular-nums xl:hidden', textTone)}>
                  {formatSimilarity(row.score)}
                </span>
              </div>
            </div>
            <span className={cn('hidden shrink-0 text-sm font-semibold tabular-nums xl:block', textTone)}>
              {formatSimilarity(row.score)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StrongholdList({
  title,
  items,
  expanded,
  leftCandidate,
  rightCandidate,
  accentColor,
  cardStyle,
  className,
}: {
  title: string;
  items: StrongholdEntry[];
  expanded: boolean;
  leftCandidate?: { senatorId: string; senatorName: string; avatarFallbackColor: string };
  rightCandidate?: { senatorId: string; senatorName: string; avatarFallbackColor: string };
  accentColor?: string;
  cardStyle?: CSSProperties;
  className?: string;
}) {
  const visibleItems = expanded ? items : items.slice(0, STRONGHOLD_PREVIEW_COUNT);
  const hiddenCount = items.length - visibleItems.length;
  const columns = [
    leftCandidate && { key: 'leftRank' as const, candidate: leftCandidate },
    rightCandidate && { key: 'rightRank' as const, candidate: rightCandidate },
  ].filter(Boolean) as Array<{
    key: 'leftRank' | 'rightRank';
    candidate: { senatorId: string; senatorName: string; avatarFallbackColor: string };
  }>;
  const gridTemplateColumns = columns.length > 1
    ? 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)'
    : 'minmax(0, 3fr) minmax(0, 1fr)';

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)} style={cardStyle}>
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {title}
      </p>
      {columns.length > 0 && (
        <div
          className="mb-2 grid items-center gap-3 border-b pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          style={{ gridTemplateColumns }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            Province
          </span>
          {columns.map(column => (
            <div
              key={column.key}
              className={cn(
                'flex flex-col items-end gap-1 text-right'
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Top prov.
              </span>
              <div className="flex items-center justify-end gap-1.5">
                <CandidateAvatar
                  senatorId={column.candidate.senatorId}
                  senatorName={column.candidate.senatorName}
                  active={false}
                  className="h-6 w-6 text-[11px]"
                  fallbackBackgroundColor={column.candidate.avatarFallbackColor}
                  fallbackTextColor="#ffffff"
                />
                {columns.length > 1 && (
                  <span className="hidden truncate xl:inline">{surnameLabel(column.candidate.senatorName)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-0.5">
        {visibleItems.length > 0 ? (
          visibleItems.map(item => (
            <div
              key={item.province}
              className="grid items-center gap-3 border-b py-1.5 last:border-b-0"
              style={{ gridTemplateColumns }}
            >
              <span className="min-w-0 truncate text-sm font-medium" title={item.province}>
                {item.province}
              </span>
              {columns.map(column => (
                <span key={column.key} className="shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
                  {item[column.key] ?? '—'}
                </span>
              ))}
            </div>
          ))
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No shared top 30 province/city
          </p>
        )}
      </div>
      {!expanded && hiddenCount > 0 && (
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {hiddenCount} more
        </p>
      )}
    </div>
  );
}

function ExplanationDisclosure({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
      >
        What this means...
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p>{children}</p>}
    </div>
  );
}

function LegendSwatch({
  kind,
  year,
}: {
  kind: 'left' | 'shared' | 'right';
  year: number;
}) {
  const sharedStroke = mixHexColors(yearColor(year), '#27272a', 0.42);
  const sharedColor = mixHexColors(yearColor(year), sharedStroke, 0.3);

  if (kind === 'shared') {
    return (
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-[4px] border"
        style={{
          borderColor: sharedStroke,
          backgroundColor: sharedColor,
          backgroundImage: [
            `repeating-linear-gradient(45deg, transparent 0 4px, ${sharedStroke} 4px 6px, transparent 6px 10px)`,
            `repeating-linear-gradient(135deg, transparent 0 4px, ${sharedStroke} 4px 6px, transparent 6px 10px)`,
          ].join(', '),
        }}
      />
    );
  }

  const baseFill = kind === 'left' ? STRONGHOLD_LEFT_COLOR : STRONGHOLD_RIGHT_COLOR;
  const stroke = kind === 'left'
    ? mixHexColors(baseFill, '#27272a', 0.34)
    : mixHexColors(baseFill, '#71717a', 0.38);
  const fill = mixHexColors(baseFill, stroke, 0.24);
  const angle = kind === 'left' ? '135deg' : '45deg';

  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rounded-[4px] border"
      style={{
        borderColor: stroke,
        backgroundColor: fill,
        backgroundImage: `repeating-linear-gradient(${angle}, transparent 0 4px, ${stroke} 4px 6px, transparent 6px 10px)`,
      }}
    />
  );
}

function StrongholdPartitionChart({
  year,
  leftLabel,
  sharedLabel,
  rightLabel,
  leftCount,
  sharedCount,
  rightCount,
}: {
  year: number;
  leftLabel: string;
  sharedLabel: string;
  rightLabel: string;
  leftCount: number;
  sharedCount: number;
  rightCount: number;
}) {
  const leftStroke = mixHexColors(STRONGHOLD_LEFT_COLOR, '#27272a', 0.34);
  const leftColor = mixHexColors(STRONGHOLD_LEFT_COLOR, leftStroke, 0.24);
  const sharedStroke = mixHexColors(yearColor(year), '#27272a', 0.42);
  const sharedColor = mixHexColors(yearColor(year), sharedStroke, 0.3);
  const rightStroke = mixHexColors(STRONGHOLD_RIGHT_COLOR, '#71717a', 0.38);
  const rightColor = mixHexColors(STRONGHOLD_RIGHT_COLOR, rightStroke, 0.24);

  const total = leftCount + sharedCount + rightCount;
  const leftOnlyPercent = total > 0 ? (leftCount / total) * 100 : 0;
  const sharedPercent = total > 0 ? (sharedCount / total) * 100 : 0;
  const rightOnlyPercent = total > 0 ? (rightCount / total) * 100 : 0;
  const leftRectWidth = total > 0 ? ((leftCount + sharedCount) / total) * 100 : 0;
  const rightRectWidth = total > 0 ? ((sharedCount + rightCount) / total) * 100 : 0;
  const overlapStart = leftOnlyPercent;
  const segments = [
    { key: 'left', value: leftCount, left: 0, width: leftOnlyPercent },
    { key: 'shared', value: sharedCount, left: overlapStart, width: sharedPercent },
    { key: 'right', value: rightCount, left: overlapStart + sharedPercent, width: rightOnlyPercent },
  ] as const;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="relative h-12 overflow-hidden rounded-md">
        <div
          className="absolute"
          style={{
            bottom: 6,
            left: 0,
            top: 6,
            width: `${leftRectWidth}%`,
            border: `1px solid ${leftStroke}`,
            borderRadius: 12,
            backgroundColor: leftColor,
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 8px, ${leftStroke} 8px 10px, transparent 10px 16px)`,
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: 6,
            left: `${overlapStart}%`,
            top: 6,
            width: `${rightRectWidth}%`,
            border: `1px solid ${rightStroke}`,
            borderRadius: 12,
            backgroundColor: rightColor,
            backgroundImage: `repeating-linear-gradient(45deg, transparent 0 8px, ${rightStroke} 8px 10px, transparent 10px 16px)`,
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: 6,
            left: `${overlapStart}%`,
            top: 6,
            width: `${sharedPercent}%`,
            backgroundColor: sharedColor,
            backgroundImage: [
              `repeating-linear-gradient(45deg, transparent 0 7px, ${sharedStroke} 7px 9px, transparent 9px 16px)`,
              `repeating-linear-gradient(135deg, transparent 0 7px, ${sharedStroke} 7px 9px, transparent 9px 16px)`,
            ].join(', '),
          }}
        />

        <div className="pointer-events-none absolute inset-0 text-white">
          {segments.map(segment => {
            const showLabel = segment.width >= 14;

            return (
              <div
                key={segment.key}
                className="absolute inset-y-0 flex min-w-0 items-center justify-center px-1 text-center font-semibold tabular-nums"
                style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
              >
                {segment.value > 0 && showLabel && (
                  <div className="truncate text-[11px] drop-shadow-md">
                    {formatPartitionLabel(segment.value, total)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:flex sm:flex-wrap sm:items-start sm:gap-x-4 sm:gap-y-2">
        <div className="flex min-h-4 items-center gap-2">
          <LegendSwatch kind="left" year={year} />
          {formatPartitionLegend(leftLabel, leftCount, total)}
        </div>
        <div className="flex min-h-4 items-center gap-2">
          <LegendSwatch kind="shared" year={year} />
          {formatPartitionLegend(sharedLabel, sharedCount, total)}
        </div>
        <div className="flex min-h-4 items-center gap-2">
          <LegendSwatch kind="right" year={year} />
          {formatPartitionLegend(rightLabel, rightCount, total)}
        </div>
      </div>
    </div>
  );
}

export default function CompareView({ selectedSenator, senators, nationalData, voteData, year }: Props) {
  const [scope, setScope] = useState<Scope>('national');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(ALL_MUNICIPALITIES);
  const [selectedCompareCandidateId, setSelectedCompareCandidateId] = useState<string | null>(null);
  const [strongholdsExpanded, setStrongholdsExpanded] = useState(false);
  const [rankExplanationOpen, setRankExplanationOpen] = useState(false);
  const [similarityExplanationOpen, setSimilarityExplanationOpen] = useState(false);
  const [strongholdsExplanationOpen, setStrongholdsExplanationOpen] = useState(false);
  const sharedColor = yearColor(year);
  const avatarFallbackColor = mixColors(yearColor(year), '#52525b', 0.38);

  const senatorNameById = useMemo(
    () => new Map(senators.map(senator => [senator.senator_id, senator.senator_name])),
    [senators]
  );

  const nationalRows = useMemo(
    () => buildNationalRows(nationalData, senatorNameById),
    [nationalData, senatorNameById]
  );

  const bestProvince = useMemo(() => {
    if (!voteData) return null;

    const byProvince = new Map<string, { votes: number; totalVotes: number }>();
    for (const municipality of Object.values(voteData.municipalities)) {
      const totalVotes = municipality.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
      const candidateVotes = municipality.candidates.find(candidate => candidate.senator_id === selectedSenator.senator_id)?.votes ?? 0;
      const current = byProvince.get(municipality.adm2_en) ?? { votes: 0, totalVotes: 0 };
      current.votes += candidateVotes;
      current.totalVotes += totalVotes;
      byProvince.set(municipality.adm2_en, current);
    }

    return Array.from(byProvince.entries())
      .map(([province, totals]) => ({
        province,
        vote_share: totals.totalVotes > 0 ? totals.votes / totals.totalVotes : 0,
      }))
      .sort((a, b) => b.vote_share - a.vote_share || a.province.localeCompare(b.province))[0]?.province ?? null;
  }, [selectedSenator.senator_id, voteData]);

  const provinces = useMemo(() => {
    if (!voteData) return [];
    return Array.from(new Set(Object.values(voteData.municipalities).map(municipality => municipality.adm2_en))).sort((a, b) => a.localeCompare(b));
  }, [voteData]);

  const effectiveProvince = selectedProvince && provinces.includes(selectedProvince)
    ? selectedProvince
    : bestProvince ?? provinces[0] ?? null;

  const municipalities = useMemo(() => {
    if (!voteData || !effectiveProvince) return [];
    return Object.entries(voteData.municipalities)
      .filter(([, municipality]) => municipality.adm2_en === effectiveProvince)
      .map(([psgc, municipality]) => ({ value: psgc, label: municipality.adm3_en }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [effectiveProvince, voteData]);

  const effectiveMunicipality = municipalities.some(option => option.value === selectedMunicipality)
    ? selectedMunicipality
    : ALL_MUNICIPALITIES;

  const comparisonRows = useMemo(() => {
    if (scope === 'national') return nationalRows;
    if (!voteData || !effectiveProvince) return [];
    if (effectiveMunicipality === ALL_MUNICIPALITIES) {
      return buildProvinceRows(voteData, effectiveProvince, senatorNameById);
    }
    return buildMunicipalityRows(voteData, effectiveMunicipality, senatorNameById);
  }, [scope, nationalRows, voteData, effectiveProvince, effectiveMunicipality, senatorNameById]);

  const provinceProfiles = useMemo(() => {
    if (!voteData) return null;

    const provinceTotals = new Map<string, { totalVotes: number; candidateVotes: Map<string, number> }>();
    for (const municipality of Object.values(voteData.municipalities)) {
      let current = provinceTotals.get(municipality.adm2_en);
      if (!current) {
        current = { totalVotes: 0, candidateVotes: new Map() };
        provinceTotals.set(municipality.adm2_en, current);
      }

      for (const candidate of municipality.candidates) {
        current.candidateVotes.set(
          candidate.senator_id,
          (current.candidateVotes.get(candidate.senator_id) ?? 0) + candidate.votes
        );
        current.totalVotes += candidate.votes;
      }
    }

    const provinceNames = Array.from(provinceTotals.keys()).sort((a, b) => a.localeCompare(b));
    const profiles = new Map<string, CandidateProvinceProfile>();

    for (const row of nationalRows) {
      const rankedShares = provinceNames
        .map(province => {
          const provinceData = provinceTotals.get(province)!;
          const votes = provinceData.candidateVotes.get(row.senator_id) ?? 0;
          const vote_share = provinceData.totalVotes > 0 ? votes / provinceData.totalVotes : 0;
          return { province, vote_share };
        });

      profiles.set(row.senator_id, {
        senator_id: row.senator_id,
        senator_name: row.senator_name,
        vector: rankedShares.map(entry => entry.vote_share),
        rankedShares: [...rankedShares].sort((a, b) => b.vote_share - a.vote_share || a.province.localeCompare(b.province)),
      });
    }

    return { provinceNames, profiles };
  }, [nationalRows, voteData]);

  const supportSimilarities = useMemo(() => {
    if (!provinceProfiles) return [];
    const selectedProfile = provinceProfiles.profiles.get(selectedSenator.senator_id);
    if (!selectedProfile) return [];

    return nationalRows
      .filter(row => row.senator_id !== selectedSenator.senator_id)
      .map(row => {
        const otherProfile = provinceProfiles.profiles.get(row.senator_id);
        return {
          senator_id: row.senator_id,
          senator_name: row.senator_name,
          score: otherProfile ? pearsonCorrelation(selectedProfile.vector, otherProfile.vector) : 0,
        };
      })
      .sort((a, b) => b.score - a.score || a.senator_name.localeCompare(b.senator_name));
  }, [nationalRows, provinceProfiles, selectedSenator.senator_id]);

  const mostSimilar = supportSimilarities.slice(0, DEFAULT_SIMILARITY_COUNT);
  const mostOpposite = [...supportSimilarities]
    .sort((a, b) => a.score - b.score || a.senator_name.localeCompare(b.senator_name))
    .slice(0, DEFAULT_SIMILARITY_COUNT);

  const compareCandidateOptions = useMemo(
    () => nationalRows
      .filter(row => row.senator_id !== selectedSenator.senator_id)
      .map(row => ({ senator_id: row.senator_id, senator_name: row.senator_name })),
    [nationalRows, selectedSenator.senator_id]
  );

  const effectiveCompareCandidate = useMemo(() => {
    if (selectedCompareCandidateId) {
      const exact = compareCandidateOptions.find(option => option.senator_id === selectedCompareCandidateId);
      if (exact) return exact;
    }
    if (mostSimilar[0]) {
      return { senator_id: mostSimilar[0].senator_id, senator_name: mostSimilar[0].senator_name };
    }
    return compareCandidateOptions[0] ?? null;
  }, [compareCandidateOptions, mostSimilar, selectedCompareCandidateId]);

  const sharedStrongholds = useMemo(() => {
    if (!provinceProfiles || !effectiveCompareCandidate) return null;

    const selectedProfile = provinceProfiles.profiles.get(selectedSenator.senator_id);
    const compareProfile = provinceProfiles.profiles.get(effectiveCompareCandidate.senator_id);
    if (!selectedProfile || !compareProfile) return null;

    const topStrongholdCount = Math.min(STRONGHOLD_LIST_COUNT, provinceProfiles.provinceNames.length);
    const selectedTop = selectedProfile.rankedShares.slice(0, topStrongholdCount);
    const compareTop = compareProfile.rankedShares.slice(0, topStrongholdCount);

    const selectedMap = new Map(selectedTop.map((entry, index) => [entry.province, { rank: index + 1, vote_share: entry.vote_share }]));
    const compareMap = new Map(compareTop.map((entry, index) => [entry.province, { rank: index + 1, vote_share: entry.vote_share }]));

    const shared = selectedTop
      .filter(entry => compareMap.has(entry.province))
      .map(entry => ({
        province: entry.province,
        leftRank: selectedMap.get(entry.province)?.rank,
        rightRank: compareMap.get(entry.province)?.rank,
        sortRank: ((selectedMap.get(entry.province)?.rank ?? topStrongholdCount) + (compareMap.get(entry.province)?.rank ?? topStrongholdCount)) / 2,
      }))
      .sort((a, b) => a.sortRank - b.sortRank || a.province.localeCompare(b.province));

    const selectedOnly = selectedTop
      .filter(entry => !compareMap.has(entry.province))
      .map(entry => ({
        province: entry.province,
        leftRank: selectedMap.get(entry.province)?.rank,
        sortRank: selectedMap.get(entry.province)?.rank ?? topStrongholdCount,
      }))
      .sort((a, b) => a.sortRank - b.sortRank || a.province.localeCompare(b.province));

    const compareOnly = compareTop
      .filter(entry => !selectedMap.has(entry.province))
      .map(entry => ({
        province: entry.province,
        rightRank: compareMap.get(entry.province)?.rank,
        sortRank: compareMap.get(entry.province)?.rank ?? topStrongholdCount,
      }))
      .sort((a, b) => a.sortRank - b.sortRank || a.province.localeCompare(b.province));

    return {
      topStrongholdCount,
      selectedOnly,
      shared,
      compareOnly,
    };
  }, [effectiveCompareCandidate, provinceProfiles, selectedSenator.senator_id]);

  const candidateLabel = headlineName(selectedSenator.senator_name);
  const sharedCardStyle = {
    backgroundColor: mixHexColors('#18181b', sharedColor, 0.14),
    borderColor: alphaColor(sharedColor, 0.34),
  } satisfies CSSProperties;
  const provincialOptions = provinces.map(province => ({ value: province, label: province }));
  const municipalityOptions = [
    { value: ALL_MUNICIPALITIES, label: 'All municipalities' },
    ...municipalities,
  ];
  const hasHiddenStrongholds = !!sharedStrongholds && (
    sharedStrongholds.selectedOnly.length > STRONGHOLD_PREVIEW_COUNT
    || sharedStrongholds.shared.length > STRONGHOLD_PREVIEW_COUNT
    || sharedStrongholds.compareOnly.length > STRONGHOLD_PREVIEW_COUNT
  );

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Where They Rank</h3>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            See how {candidateLabel} ranks against other candidates.
          </p>
        </div>

        <div className="space-y-3">
          <ScopeToggle scope={scope} onChange={setScope} />

          {scope === 'provincial' && voteData && effectiveProvince && (
            <div className="grid gap-3 md:grid-cols-2">
              <CompareCombobox
                label="Province"
                value={effectiveProvince}
                options={provincialOptions}
                onChange={value => setSelectedProvince(value)}
                placeholder="Select province..."
              />
              <CompareCombobox
                label="Municipality"
                value={effectiveMunicipality}
                options={municipalityOptions}
                onChange={value => setSelectedMunicipality(value)}
                placeholder="Select municipality..."
              />
            </div>
          )}
        </div>

        {scope === 'provincial' && !voteData ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-12">
            <Spinner label="Loading provincial rankings..." />
          </div>
        ) : comparisonRows.length > 0 ? (
          <>
            <RankTable
              rows={comparisonRows}
              selectedSenatorId={selectedSenator.senator_id}
              avatarFallbackColor={avatarFallbackColor}
            />
            <ExplanationDisclosure
              open={rankExplanationOpen}
              onToggle={() => setRankExplanationOpen(current => !current)}
            >
              The last column shows how far each candidate is above or below the average vote share
              in this group. {candidateLabel}&apos;s row stays highlighted so they are easy to compare.
            </ExplanationDisclosure>
          </>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No ranking data found for this selection.
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Similar Support Pattern</h3>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            See which candidates had support patterns most similar to, or most different from,{' '}
            {candidateLabel} across {provinceProfiles?.provinceNames.length ?? 0} shared
            provinces/cities.
          </p>
        </div>

        {!voteData || !provinceProfiles ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-12">
            <Spinner label="Loading support patterns..." />
          </div>
        ) : (
          <>
            <CandidateCard
              senatorId={selectedSenator.senator_id}
              senatorName={selectedSenator.senator_name}
              avatarFallbackColor={avatarFallbackColor}
            />

            <div className="grid grid-cols-2 gap-4">
              <SimilarityColumn
                title="Most Similar"
                tone="similar"
                rows={mostSimilar}
                avatarFallbackColor={avatarFallbackColor}
              />
              <SimilarityColumn
                title="Most Opposite"
                tone="opposite"
                rows={mostOpposite}
                avatarFallbackColor={avatarFallbackColor}
              />
            </div>

            <ExplanationDisclosure
              open={similarityExplanationOpen}
              onToggle={() => setSimilarityExplanationOpen(current => !current)}
            >
              A higher score means the two candidates were strong and weak in many of the same
              places. This may suggest they appealed to similar voters, but it does not prove they
              were allies.
            </ExplanationDisclosure>
          </>
        )}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Shared Strongholds</h3>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            See which provinces were among {candidateLabel}&apos;s strongest areas in {year}, and where
            those strong areas overlap with the other candidate.
          </p>
        </div>

        {!voteData || !provinceProfiles || !effectiveCompareCandidate || !sharedStrongholds ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-12">
            <Spinner label="Loading shared strongholds..." />
          </div>
        ) : (
          <>
            <div className="relative grid grid-cols-2 items-center gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <CandidateCard
                senatorId={selectedSenator.senator_id}
                senatorName={selectedSenator.senator_name}
                avatarFallbackColor={avatarFallbackColor}
                stackOnMobile
                className="min-h-[8.5rem] xl:min-h-0"
              />
              <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-[1] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-sm font-semibold text-muted-foreground xl:hidden">
                &
              </div>
              <div className="mx-auto hidden h-10 w-10 items-center justify-center rounded-full border bg-card text-sm font-semibold text-muted-foreground xl:col-start-2 xl:flex">
                &
              </div>
              <CandidateCombobox
                value={effectiveCompareCandidate}
                options={compareCandidateOptions}
                onChange={setSelectedCompareCandidateId}
                avatarFallbackColor={avatarFallbackColor}
                className="min-h-[8.5rem] xl:col-start-3 xl:min-h-0"
                stackOnMobile
              />
            </div>

            <StrongholdPartitionChart
              year={year}
              leftLabel={`${surnameLabel(selectedSenator.senator_name)} only`}
              sharedLabel="Shared"
              rightLabel={`${surnameLabel(effectiveCompareCandidate.senator_name)} only`}
              leftCount={sharedStrongholds.selectedOnly.length}
              sharedCount={sharedStrongholds.shared.length}
              rightCount={sharedStrongholds.compareOnly.length}
            />

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Top {sharedStrongholds.topStrongholdCount} provinces/cities for each candidate, including the places they share.
              </p>

              <div className="grid grid-cols-2 gap-6">
              <StrongholdList
                title={`${surnameLabel(selectedSenator.senator_name)} only (${sharedStrongholds.selectedOnly.length})`}
                items={sharedStrongholds.selectedOnly}
                expanded={strongholdsExpanded}
                leftCandidate={{
                  senatorId: selectedSenator.senator_id,
                  senatorName: selectedSenator.senator_name,
                  avatarFallbackColor,
                }}
                className="order-2"
              />
              <StrongholdList
                title={`Shared (${sharedStrongholds.shared.length})`}
                items={sharedStrongholds.shared}
                expanded={strongholdsExpanded}
                leftCandidate={{
                  senatorId: selectedSenator.senator_id,
                  senatorName: selectedSenator.senator_name,
                  avatarFallbackColor,
                }}
                rightCandidate={{
                  senatorId: effectiveCompareCandidate.senator_id,
                  senatorName: effectiveCompareCandidate.senator_name,
                  avatarFallbackColor,
                }}
                cardStyle={sharedCardStyle}
                className="order-1 col-span-2"
              />
              <StrongholdList
                title={`${surnameLabel(effectiveCompareCandidate.senator_name)} only (${sharedStrongholds.compareOnly.length})`}
                items={sharedStrongholds.compareOnly}
                expanded={strongholdsExpanded}
                rightCandidate={{
                  senatorId: effectiveCompareCandidate.senator_id,
                  senatorName: effectiveCompareCandidate.senator_name,
                  avatarFallbackColor,
                }}
                className="order-3"
              />
            </div>
            </div>

            {(hasHiddenStrongholds || strongholdsExpanded) && (
              <button
                type="button"
                onClick={() => setStrongholdsExpanded(current => !current)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {strongholdsExpanded ? 'Show less' : 'Show all'}
              </button>
            )}

            <ExplanationDisclosure
              open={strongholdsExplanationOpen}
              onToggle={() => setStrongholdsExplanationOpen(current => !current)}
            >
              {sharedStrongholds.shared.length} of their top {sharedStrongholds.topStrongholdCount}{' '}
              provinces/cities are the same. {strongholdOverlapAssessment(sharedStrongholds.shared.length)}
            </ExplanationDisclosure>
          </>
        )}
      </div>
    </section>
  );
}
