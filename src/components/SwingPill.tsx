import { swingColor, swingRoundsToZero } from '@/lib/swing';

type Props = {
  delta: number;
  /** 'pt' (default): delta is a share fraction, displayed as percentage points (×100).
   *  'x': delta is already in index units (e.g. province-vs-national multiplier), shown as-is. */
  suffix?: 'pt' | 'x';
};

// "▴ 4.2pt" / "▾ 0.3x" — the one-glance swing indicator shared by every chart
// header in the candidate profile (national trend, province trend).
export default function SwingPill({ delta, suffix = 'pt' }: Props) {
  const scale = suffix === 'pt' ? 100 : 1;
  const isZero = swingRoundsToZero(delta, scale);
  const color = swingColor(delta, scale);
  const magnitude = suffix === 'pt' ? Math.abs(delta * 100) : Math.abs(delta);
  return (
    <span
      className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2"
      style={{ background: `${color}24`, color }}
    >
      {isZero ? '▪' : delta >= 0 ? '▴' : '▾'} {magnitude.toFixed(1)}{suffix}
    </span>
  );
}
