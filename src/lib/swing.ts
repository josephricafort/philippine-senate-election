// Shared "gained ground vs. lost ground" visual language used by every swing-style
// chart in the candidate profile (national trend, province trend, municipality bars):
// green line/bar = gained since the candidate's first run, red = lost.
export const GAIN = '#4ade80';
export const LOSS = '#f87171';

export function swingColor(delta: number): string {
  return delta >= 0 ? GAIN : LOSS;
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
  if (delta === 0) return SWING_ZERO_COLOR;
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
