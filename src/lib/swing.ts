// Shared "gained ground vs. lost ground" visual language used by every swing-style
// chart in the candidate profile (national trend, province trend, municipality bars):
// green line/bar = gained since the candidate's first run, red = lost.
export const GAIN = '#4ade80';
export const LOSS = '#f87171';
// Same neutral used by the map's exact-zero bucket — reused here so "no meaningful
// change" reads identically everywhere, not just on the choropleth.
export const NEUTRAL = '#a1a1aa';

// A delta "rounds to zero" if, at the precision the UI actually displays it, the sign
// would be invisible (e.g. a 0.03pt swing shows as "+0.0pt" — a sign with no visible
// magnitude behind it). `scale` matches whatever multiplier the caller's own display
// string applies before rounding to 1 decimal place: 100 for percentage-point deltas
// (the x100 in formatSwingPt), 1 for raw index-unit deltas (province-vs-national "x").
// This must be the single source of truth for "is this effectively zero" — coloring
// and display text must never disagree about it, or a colored dot next to "0.0pt"
// reads as a bug (a real value with an invisible sign looks like noise otherwise).
export function swingRoundsToZero(delta: number, scale: number = 100): boolean {
  return Math.abs(delta * scale).toFixed(1) === '0.0';
}

// The raw-delta threshold below which a pt-scale delta rounds to "0.0pt" (see
// swingRoundsToZero, scale=100) — |delta*100| < 0.05, i.e. |delta| < 0.0005. Exported
// as a plain number (not a function) because MapLibre GL style expressions are
// evaluated by the map's own runtime, not JS, so ChoroplethMap's fill-color expression
// can't call swingRoundsToZero directly — it has to inline this same threshold as a
// literal ['>', ...]/['<', ...] range instead of the exact-zero check it used before.
export const SWING_ZERO_THRESHOLD = 0.0005;

export function swingColor(delta: number, scale: number = 100): string {
  if (swingRoundsToZero(delta, scale)) return NEUTRAL;
  return delta >= 0 ? GAIN : LOSS;
}

export type SwingHeadlineDirection = 'loss' | 'gain' | 'mixed' | 'flat';

// A headlinePart's `text` is a full clause (words + punctuation), but OG cards render it
// word-by-word (see the two share/*/og-image routes) so each word can carry its own font —
// prose in Source Sans, any word touching a digit (a count, a percentage, a year) in Source
// Code — matching how the rest of the app treats numbers as a distinct visual register from
// body text. A word "counts" as numeric if it contains any digit, so "(67%)" and "2019" both
// qualify without needing to strip surrounding punctuation first.
export function wordIsNumeric(word: string): boolean {
  return /\d/.test(word);
}

// Shared "N out of TOTAL (%) <unit> <verb> between yearA and yearB" headline builder — used by
// every "how did this candidate's support move" summary (province-level and municipality-level,
// both the general VoteData version and the per-candidate CandidateData version in lib/data.ts)
// so the direction/wording rules only have to be gotten right in one place.
//
// A row whose delta rounds to 0.0pt (see swingRoundsToZero) is neither a gain nor a loss — an
// earlier version counted it as "gained" just because raw delta >= 0, which meant a candidate
// whose numbers were almost entirely noise-level unchanged could be reported as having "gained
// support from 953 out of 1623 (59%)" municipalities, wildly overstating a swing that mostly
// didn't happen. Those rows are pulled into their own `flat` bucket and excluded from the
// gain/loss percentage entirely, with a 4th headline case ("barely moved") that fires whenever
// they're the majority — matching how `direction` already reads "mixed" instead of forcing a
// one-sided claim once no single bucket has a real majority.
export function buildSwingHeadline(
  rows: { delta: number }[],
  name: string,
  unit: string,
  yearA: number,
  yearB: number
): {
  headline: string;
  headlineParts: { text: string; emphasis?: 'gain' | 'loss' | 'flat' }[];
  breadth: { total: number; losing: number; gaining: number; flat: number; direction: SwingHeadlineDirection };
} {
  const total = rows.length;
  const flat = rows.filter(r => swingRoundsToZero(r.delta)).length;
  const moved = rows.filter(r => !swingRoundsToZero(r.delta));
  const losing = moved.filter(r => r.delta < 0).length;
  const gaining = moved.length - losing;
  const flatPct = flat / total;
  const losingPct = moved.length > 0 ? losing / moved.length : 0;

  // A flat majority takes priority over gain/loss/mixed — a candidate whose numbers barely
  // moved anywhere isn't meaningfully "mixed" just because the sliver that did move split
  // close to 50/50; the real story is that most places didn't move at all.
  const direction: SwingHeadlineDirection =
    flatPct > 0.5 ? 'flat' : losingPct > 0.5 ? 'loss' : losingPct < 0.5 ? 'gain' : 'mixed';

  let headlineParts: { text: string; emphasis?: 'gain' | 'loss' | 'flat' }[];
  if (direction === 'flat') {
    const pct = Math.round((flat / total) * 100);
    headlineParts = [
      { text: `${name}'s support ` },
      { text: 'barely moved', emphasis: 'flat' },
      { text: ' in ' },
      { text: `${flat} out of ${total} (${pct}%)`, emphasis: 'flat' },
      { text: ` ${unit} between ${yearA} and ${yearB} elections.` },
    ];
  } else if (direction === 'mixed') {
    headlineParts = [
      { text: `${name}'s support was mixed` },
      { text: ` — falling in ${losing} and rising in ${gaining} of ${moved.length} ${unit}` },
      { text: ` between ${yearA} and ${yearB}.` },
    ];
  } else {
    const count = direction === 'loss' ? losing : gaining;
    const pct = Math.round((count / moved.length) * 100);
    const verb = direction === 'loss' ? 'lost' : 'gained';
    headlineParts = [
      { text: `${name} ` },
      { text: verb, emphasis: direction },
      { text: ' support from ' },
      { text: `${count} out of ${moved.length} (${pct}%)`, emphasis: direction },
      { text: ` ${unit} between ${yearA} and ${yearB} elections.` },
    ];
  }

  return {
    headline: headlineParts.map(p => p.text).join(''),
    headlineParts,
    breadth: { total, losing, gaining, flat, direction },
  };
}

// Swing uses 10 discrete buckets, 5 shades of loss + 5 shades of gain split exactly at zero —
// no neutral/"flat" bucket, so every municipality reads as a clear direction rather than
// blending into a middle band. Shared by the live map (ChoroplethMap) and the static map-share
// OG image, which must paint identical colors for the identical data — any drift here would
// make the shared graphic lie about what the interactive map actually shows.
export const SWING_LOSS_COLORS = ['#fee2e2', '#fca5a5', '#ef4444', '#b91c1c', '#7f1d1d']; // mild -> strong loss
export const SWING_GAIN_COLORS = ['#bbf7d0', '#86efac', '#22c55e', '#15803d', '#14532d']; // mild -> strong gain
export const SWING_BUCKET_COLORS = [...[...SWING_LOSS_COLORS].reverse(), ...SWING_GAIN_COLORS];
// Exact-zero swing gets its own subtle gray rather than falling into the lightest gain
// bucket — a municipality with literally no measured change shouldn't read as "gained".
export const SWING_ZERO_COLOR = '#d4d4d8';

export const SWING_BUCKETS_PER_SIDE = 5;

// Largest absolute swing across all municipalities, on either side — the shared scale anchor.
// Both loss and gain sides are bucketed against this SAME value (not each side's own max), so
// color intensity means the same thing on both sides. See swingBucketBounds for why.
export function swingMaxAbs(swingByPsgc: Map<string, { delta: number }>): number {
  let max = 0;
  for (const entry of swingByPsgc.values()) max = Math.max(max, Math.abs(entry.delta));
  return max;
}

// Equal-width magnitude bounds, both sides scaled against the SAME maxAbs (see swingMaxAbs) —
// not each side's own max, and not count-based quantiles. Equal-width steps of the same shared
// scale is what makes a given shade mean the same swing size everywhere on the map, independent
// of which side it's on or how the data clusters.
export function swingBucketBounds(maxAbs: number): {
  lossBounds: number[]; // [-4/5, -3/5, -2/5, -1/5] of maxAbs, ascending
  gainBounds: number[]; // [+1/5, +2/5, +3/5, +4/5] of maxAbs, ascending
} {
  const n = SWING_BUCKETS_PER_SIDE;
  const fifth = maxAbs / n;
  const lossBounds = Array.from({ length: n - 1 }, (_, i) => -fifth * (n - 1 - i));
  const gainBounds = Array.from({ length: n - 1 }, (_, i) => fifth * (i + 1));
  return { lossBounds, gainBounds };
}

// Maps a single delta to its bucket color using the same equal-width bounds as
// swingBucketBounds/SWING_BUCKET_COLORS — the one place that per-municipality swing-to-color
// mapping should live so the live map and the static share graphic can never drift apart.
// lossBounds/gainBounds are ascending, so a lower findIndex hit on the loss side means a MORE
// extreme (more negative) delta — that has to map to the strongest shade, i.e. the END of
// SWING_LOSS_COLORS (mild -> strong), hence the n-1-idx flip. The gain side runs the other way:
// a higher gainBounds index already means a stronger gain, so it indexes SWING_GAIN_COLORS directly.
export function swingBucketColor(delta: number, maxAbs: number): string {
  if (swingRoundsToZero(delta)) return SWING_ZERO_COLOR;
  if (maxAbs === 0) return SWING_ZERO_COLOR;
  const n = SWING_BUCKETS_PER_SIDE;
  const { lossBounds, gainBounds } = swingBucketBounds(maxAbs);
  if (delta < 0) {
    const idx = lossBounds.findIndex(b => delta < b);
    return SWING_LOSS_COLORS[n - 1 - (idx === -1 ? n - 1 : idx)];
  }
  const idx = gainBounds.findIndex(b => delta <= b);
  return SWING_GAIN_COLORS[idx === -1 ? n - 1 : idx];
}

// Formats a vote-share delta's sign + magnitude for display — the ONLY place this logic
// should live anywhere in the app. Rounding a small negative delta (e.g. -0.0003) to 1
// decimal place can still yield the string "-0.0", which reads as a negative zero to users
// even though the underlying value is real (not float noise — see
// nationwideMunicipalitySwing's own noise-rounding, which is a separate, smaller-magnitude
// fix). This checks the ROUNDED display string itself, not the raw sign, so a value that
// rounds to zero at this precision always gets a blank sign — "-0.0" can never render.
export function formatSwingParts(delta: number): { sign: '+' | '−' | ''; magnitude: string } {
  const magnitude = Math.abs(delta * 100).toFixed(1);
  const sign = Number(magnitude) === 0 ? '' : delta > 0 ? '+' : '−';
  return { sign, magnitude };
}

// Convenience wrapper for the common case of "sign + magnitude + pt" as one string.
export function formatSwingPt(delta: number): string {
  const { sign, magnitude } = formatSwingParts(delta);
  return `${sign}${magnitude}pt`;
}

// First-point-to-last-point delta in vote share — the one-glance number shown in a chart's swing pill.
export function netSwing(trend: { vote_share: number }[]): number {
  return trend.length > 1 ? trend[trend.length - 1].vote_share - trend[0].vote_share : 0;
}

// Directional vocabulary for programmatic headline templates — every headline that describes
// a swing must flip its verb based on the sign of the underlying number, since a single fixed
// wording ("X's support fell...") would be factually wrong for any candidate whose numbers
// moved the other way. This is the one place that word-swap logic lives.
export function directionalVerb(delta: number): 'fell' | 'rose' {
  return delta >= 0 ? 'rose' : 'fell';
}

export type YearPair = [number, number];

// Consecutive-run pairs for a candidate — e.g. Pangilinan ran 2007, 2016, 2025, so
// the pairs are [2007,2016] and [2016,2025]. Skipped cycles (2010, 2013, ...) are
// never a pair endpoint since the candidate wasn't on the ballot then.
// Framework-agnostic (no 'use client') so both the interactive explorer page and the
// static server-rendered share page can compute pairs without pulling in client code.
export function consecutivePairs(years: number[]): YearPair[] {
  const sorted = [...years].sort((a, b) => a - b);
  const pairs: YearPair[] = [];
  for (let i = 0; i < sorted.length - 1; i++) pairs.push([sorted[i], sorted[i + 1]]);
  return pairs;
}

// Picks `sampleSize` representative rows from a delta-sorted list — biggest drop, evenly spaced
// quantiles, biggest gain — so a collapsed diverging-bar chart shows the spread of the distribution
// rather than an arbitrary top-N. Shared by the municipality and province swing bar charts so their
// sampling behaves identically (labels, dedup) at different sample sizes.
export function quartileSample<T extends { delta: number }>(
  rows: T[],
  key: (row: T) => string,
  sampleSize: number
): { row: T; label: string }[] {
  if (rows.length <= sampleSize) return rows.map(row => ({ row, label: '' }));

  const n = rows.length;
  const at = (frac: number) => rows[Math.round(frac * (n - 1))];

  // Evenly spaced fractions from 0 (biggest drop) to 1 (biggest gain), labeled by position.
  const fractions = Array.from({ length: sampleSize }, (_, i) => i / (sampleSize - 1));
  const picks = fractions.map((frac, i) => {
    let label: string;
    if (i === 0) label = 'Biggest drop';
    else if (i === sampleSize - 1) label = 'Biggest gain';
    else if (frac === 0.5) label = 'Median';
    else label = `${Math.round(frac * 100)}th pct.`;
    return { row: at(frac), label };
  });

  // Dedupe in case rounding collapses two quantiles onto the same row (small n).
  const seen = new Set<string>();
  return picks.filter(p => (seen.has(key(p.row)) ? false : (seen.add(key(p.row)), true)));
}
