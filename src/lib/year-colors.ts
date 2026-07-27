import type { ElectionYear } from './types';

// One fixed accent per election year, reused everywhere a year is represented
// (year selector, candidate pills, trend line, leaderboard) so color reads as
// "which year" at a glance across the app.
export const YEAR_COLORS: Record<ElectionYear, string> = {
  2007: '#1d4ed8', // ballot blue
  2010: '#16a34a', // sampaguita green
  2013: '#e08a00', // jeepney marigold
  2016: '#dc2626', // tricycle red
  2019: '#7c3aed', // ube violet
  2022: '#db2777', // bougainvillea magenta
  2025: '#0891b2', // Boracay teal
};

export function yearColor(year: number): string {
  return YEAR_COLORS[year as ElectionYear] ?? '#6366f1';
}
