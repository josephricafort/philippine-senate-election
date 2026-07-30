import type { ElectionYear } from './types';

// One fixed accent per election year, reused everywhere a year is represented
// (year selector, candidate pills, trend line, leaderboard) so color reads as
// "which year" at a glance across the app.
// 2010 and 2016 were originally green/red (sampaguita green, tricycle red) — both too close to
// GAIN (#4ade80) and LOSS (#f87171), which use that same red/green pairing everywhere else in
// the app (swing bars, trend sparklines, the choropleth map) to mean gain/loss specifically. A
// red or green year badge next to a same-colored gain/loss indicator read as "this is good/bad
// news" rather than "this is year X". A brown/taupe pairing was tried next but rejected too: it
// crowded 2013's marigold (same warm/gold family) and read too close to NEUTRAL/SWING_ZERO's
// grays (#a1a1aa / #d4d4d8) — another reserved meaning ("no change"). Settled on two jewel
// tones, brightened as far as the palette allows: every other year sits at ~45-58% HSL
// lightness, but pushing these two that bright puts them within ~40-90 RGB units of magenta,
// teal, or the gain/green colors — there's no hue angle in that brightness band clear of every
// reserved color at once. These sit at ~28% lightness as the deliberate compromise: brighter
// than a "safe" dark pick, while keeping ~100-120+ unit separation from every neighbor.
export const YEAR_COLORS: Record<ElectionYear, string> = {
  2007: '#1d4ed8', // ballot blue
  2010: '#1c5257', // brighter petrol
  2013: '#e08a00', // jeepney marigold
  2016: '#7a1734', // brighter wine
  2019: '#7c3aed', // ube violet
  2022: '#db2777', // bougainvillea magenta
  2025: '#0891b2', // Boracay teal
};

export function yearColor(year: number): string {
  return YEAR_COLORS[year as ElectionYear] ?? '#6366f1';
}
