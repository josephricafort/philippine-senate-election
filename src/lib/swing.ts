// Shared "gained ground vs. lost ground" visual language used by every swing-style
// chart in the candidate profile (national trend, province trend, municipality bars):
// green line/bar = gained since the candidate's first run, red = lost.
export const GAIN = '#4ade80';
export const LOSS = '#f87171';

export function swingColor(delta: number): string {
  return delta >= 0 ? GAIN : LOSS;
}

// First-point-to-last-point delta in vote share — the one-glance number shown in a chart's swing pill.
export function netSwing(trend: { vote_share: number }[]): number {
  return trend.length > 1 ? trend[trend.length - 1].vote_share - trend[0].vote_share : 0;
}
