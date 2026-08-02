import { yearColor } from './year-colors';

export const LEADERBOARD_MEDAL_STYLES: Record<number, { background: string; color: string }> = {
  1: { background: '#fdf3d8', color: '#b8860b' },
  2: { background: '#eef1f3', color: '#78808c' },
  3: { background: '#fbe9dc', color: '#a6591f' },
};

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

export function leaderboardYearColors(year: number) {
  const activeYearColor = yearColor(year);

  return {
    activeYearColor,
    highlightBackground: mixHexColors(activeYearColor, '#18181b', 0.86),
    highlightBorder: mixHexColors(activeYearColor, '#f4f4f5', 0.24),
    highlightBadgeBackground: mixHexColors(activeYearColor, '#27272a', 0.48),
    defaultAvatarColor: mixHexColors(activeYearColor, '#52525b', 0.62),
    highlightAvatarColor: mixHexColors(activeYearColor, '#f4f4f5', 0.72),
  };
}
