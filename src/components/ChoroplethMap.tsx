'use client';
import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature, mesh, merge } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { ChevronLeft, Home, Plus, Minus } from 'lucide-react';
import type { CandidateData, CandidateYearData, MunicipalityNames, Metric } from '@/lib/types';
import { yearColor } from '@/lib/year-colors';
import {
  formatSwingPt,
  swingColor,
  swingRoundsToZero,
  SWING_LOSS_COLORS,
  SWING_GAIN_COLORS,
  SWING_BUCKET_COLORS,
  SWING_ZERO_COLOR,
  SWING_BUCKETS_PER_SIDE,
  swingMaxAbs,
  swingBucketBounds,
} from '@/lib/swing';
import { trackEvent } from '@/lib/analytics';
type SwingEntry = { delta: number };

type Props = {
  candidate: CandidateData | null;
  /** Candidate-independent psgc -> {adm3_en, adm2_en} lookup — used for province labels and
   *  "no data" tooltips, which need a name even for municipalities the selected candidate has
   *  no entry for (per-candidate files only include municipalities that candidate has votes in). */
  municipalityNames: MunicipalityNames;
  senatorId: string | null;
  senatorName: string | null;
  year: number | null;
  metric: Metric;
  /** Per-municipality swing (psgc -> delta), required when metric === 'swing'. */
  swingMap?: Map<string, SwingEntry> | null;
  /** The two years being compared for the swing metric, e.g. [2019, 2025]. */
  swingYears?: [number, number] | null;
  onNavigateToProfile?: () => void;
  /** Lets the "no swing data" overlay switch the map to another metric directly, without
   *  making the user find the View By toggle themselves. */
  onChangeMetric?: (metric: Metric) => void;
};

const PH_CENTER: [number, number] = [122, 12.8];
const DEFAULT_ZOOM = 5;
// Padded box around the default view — keeps panning from drifting past the
// Philippines even at the min zoom, without pinning the map rigidly to center.
const MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [PH_CENTER[0] - 10, PH_CENTER[1] - 10],
  [PH_CENTER[0] + 10, PH_CENTER[1] + 10],
];
const NO_DATA_COLOR = '#d4d4d8'; // light neutral — blends into toner_lite's land

// Single-hue sequential ramp, light -> dark, so the ramp stays one hue per the
// data-viz rule (never a rainbow). The hue itself is the selected year's accent
// color, so the map reads as part of the same year-color system used by the
// selector, pills, trend chart, and leaderboard elsewhere in the app.
function sequentialStops(hex: string): string[] {
  const [h, s] = hexToHsl(hex);
  const lSteps = [92, 78, 58, 40, 24];
  const sSteps = [Math.min(s * 0.55, 45), Math.min(s * 0.8, 65), s, Math.min(s * 1.05, 95), Math.min(s * 1.05, 90)];
  return lSteps.map((l, i) => `hsl(${h.toFixed(0)}, ${sSteps[i].toFixed(0)}%, ${l}%)`);
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  if (d !== 0) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

const FRACS = [0, 0.25, 0.5, 0.75, 1];

// Shoelace-formula centroid + area of a single polygon ring (outer ring only —
// good enough for label placement, no need to subtract holes).
function ringCentroidArea(ring: [number, number][]): { cx: number; cy: number; area: number } {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (area === 0) return { cx: ring[0][0], cy: ring[0][1], area: 0 };
  return { cx: cx / (6 * area), cy: cy / (6 * area), area: Math.abs(area) };
}

// Area-weighted centroid across every polygon/ring belonging to a municipality feature,
// so multi-island municipalities (and later, multi-municipality provinces) label sensibly
// at their largest landmass rather than an average that can fall in open water.
function featureCentroid(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): { cx: number; cy: number; area: number } {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best = { cx: 0, cy: 0, area: 0 };
  for (const poly of polygons) {
    const outer = poly[0] as [number, number][];
    const c = ringCentroidArea(outer);
    if (c.area > best.area) best = c;
  }
  return best;
}

// PSGC region code for the National Capital Region — NCR has no real province layer.
// Its adm2_pcode values are administrative "districts" (1st–4th NCR district) that don't
// match any single city's boundary or name, so grouping by adm2_pcode there produced
// nonsense: 3–6 unrelated cities dissolved into one shape labeled with whichever city's
// name happened to be read first (e.g. a Manila/Makati/Muntinlupa blob labeled "Las Piñas
// City"). NCR's cities are grouped under one "Metro Manila" label instead — the province
// dissolve/label logic below only applies outside NCR.
const NCR_REGION_PCODE = 'PH13';
const NCR_LABEL = 'Metro Manila';

// Province name labels — one point per province (or, for NCR, one "Metro Manila" point),
// placed at the centroid of the dissolved shape of all its municipalities merged into one
// polygon — not derived from any single municipality, which previously placed labels off
// toward wherever one municipality's landmass happened to sit rather than the visual middle
// of the whole shape. Names come from municipalityNames — a candidate-independent lookup — so
// labels always resolve regardless of which candidate is selected or whether that candidate
// has a data entry for every municipality in the province (per-candidate files only include
// municipalities that candidate has votes in). adm3_psgc is the join key shared between the
// topojson and municipalityNames.
function buildProvinceLabelPoints(
  topo: Topology,
  municitiesObj: GeometryCollection<{ adm1_pcode: string; adm2_pcode: string }>,
  municipalityNames: MunicipalityNames
): GeoJSON.FeatureCollection<GeoJSON.Point, { name: string }> {
  const byGroup = new Map<string, typeof municitiesObj.geometries>();
  const nameByGroup = new Map<string, string>();

  for (const g of municitiesObj.geometries) {
    const props = g.properties as { adm1_pcode?: string; adm2_pcode?: string; adm3_psgc?: string } | undefined;
    const psgc = props?.adm3_psgc;
    if (!psgc) continue;

    const isNcr = props?.adm1_pcode === NCR_REGION_PCODE;
    const groupKey = isNcr ? NCR_REGION_PCODE : props?.adm2_pcode;
    if (!groupKey) continue;

    if (!nameByGroup.has(groupKey)) {
      const name = isNcr ? NCR_LABEL : municipalityNames[psgc]?.adm2_en;
      if (name) nameByGroup.set(groupKey, name);
    }
    const list = byGroup.get(groupKey);
    if (list) list.push(g);
    else byGroup.set(groupKey, [g]);
  }

  const points: GeoJSON.Feature<GeoJSON.Point, { name: string }>[] = [];
  for (const [groupKey, geoms] of byGroup) {
    const name = nameByGroup.get(groupKey);
    if (!name) continue;
    const dissolved = merge(topo, geoms as Parameters<typeof merge>[1]);
    const c = featureCentroid(dissolved);
    if (c.area === 0) continue;
    points.push({
      type: 'Feature',
      properties: { name },
      geometry: { type: 'Point', coordinates: [c.cx, c.cy] },
    });
  }

  return { type: 'FeatureCollection', features: points };
}

const NO_DATA_SENTINEL = -1; // value returned by match when psgc has no data

// Fixed scale caps — consistent across all senators so color comparisons are meaningful.
// vote_share: 15% covers p90 of per-senator peaks (data: p50≈8%, p90≈14.5%)
// votes: 50 000 raw votes as a reasonable stronghold threshold
const VOTE_SHARE_CAP = 0.15;
const RAW_VOTES_CAP  = 50_000;

// Swing uses 10 discrete buckets, 5 shades of loss + 5 shades of gain split exactly at zero —
// no neutral/"flat" bucket, so every municipality reads as a clear direction rather than
// blending into a middle band. (An earlier version used a white midpoint; continuous
// interpolation toward it washed out almost the whole map since most swings cluster near
// zero, and even a 5-bucket version with a neutral band undersold small-but-real movement.)
// Thresholds scale to each candidate's own min/max swing (same idea as the Rank metric
// scaling to that candidate's maxRank) so the full color range is always used, rather than
// a fixed cap leaving most candidates' maps mostly in the lightest bucket.
// Colors/bounds themselves live in lib/swing.ts (shared with the static map-share OG image,
// which must paint identical colors for identical data).

// Per-bucket municipality counts for the same 10 equal-width buckets swingBucketBounds carves
// out (plus the exact-zero count) — this must bin by the identical bounds the map paints with,
// or the legend's bar heights/colors stop corresponding to what's shaded on the map. A delta
// that rounds to 0.0pt is counted as zero here too (see swingRoundsToZero) — otherwise the
// legend's zero bar and the map's zero-colored municipalities wouldn't agree on which
// municipalities actually belong in it.
function swingBucketCounts(
  swingMap: Map<string, SwingEntry>,
  lossBounds: number[],
  gainBounds: number[]
): { lossCounts: number[]; gainCounts: number[]; zeroCount: number } {
  const n = SWING_BUCKETS_PER_SIDE;
  const lossCounts = new Array(n).fill(0);
  const gainCounts = new Array(n).fill(0);
  let zeroCount = 0;
  for (const { delta } of swingMap.values()) {
    if (swingRoundsToZero(delta)) {
      zeroCount++;
    } else if (delta < 0) {
      const idx = lossBounds.findIndex(b => delta < b);
      lossCounts[idx === -1 ? n - 1 : idx]++;
    } else {
      const idx = gainBounds.findIndex(b => delta <= b);
      gainCounts[idx === -1 ? n - 1 : idx]++;
    }
  }
  return { lossCounts, gainCounts, zeroCount };
}

function buildMatchExpression(
  yearData: CandidateYearData,
  metric: Metric,
  swingMap?: Map<string, SwingEntry> | null
): maplibregl.ExpressionSpecification {
  const pairs: (string | number)[] = [];
  if (metric === 'swing') {
    for (const [psgc, entry] of swingMap ?? []) {
      pairs.push(psgc, entry.delta);
    }
  } else {
    for (const [psgc, m] of Object.entries(yearData.municipalities)) {
      let val: number;
      if (metric === 'vote_share') val = Math.min(m.vote_share, VOTE_SHARE_CAP);
      else if (metric === 'rank')  val = m.rank;
      else                         val = Math.min(m.votes, RAW_VOTES_CAP);
      pairs.push(psgc, val);
    }
  }
  // Fallback -1 signals "no data" — real vote-share/votes/rank values are always >= 0.
  // Swing deltas can be negative, so they're offset by +1 below the match/interpolate boundary
  // instead of relying on sign to detect "no data" — see the swing branch in buildColorExpression.
  return ['match', ['get', 'adm3_psgc'], ...pairs, NO_DATA_SENTINEL] as unknown as maplibregl.ExpressionSpecification;
}

function buildColorExpression(
  yearData: CandidateYearData,
  metric: Metric,
  year: number | null,
  swingMap?: Map<string, SwingEntry> | null
): maplibregl.ExpressionSpecification {
  const valueExpr = buildMatchExpression(yearData, metric, swingMap);
  // Wrap with case: sentinel → NO_DATA_COLOR, otherwise → interpolated color
  const noDataGuard = (colorExpr: unknown) =>
    ['case', ['==', valueExpr, NO_DATA_SENTINEL], NO_DATA_COLOR, colorExpr] as unknown as maplibregl.ExpressionSpecification;

  if (metric === 'swing') {
    if (!swingMap || swingMap.size === 0) return NO_DATA_COLOR as unknown as maplibregl.ExpressionSpecification;
    const maxAbs = swingMaxAbs(swingMap);
    if (maxAbs === 0) return SWING_ZERO_COLOR as unknown as maplibregl.ExpressionSpecification;
    // 10 discrete bands, both sides scaled against the same shared maxAbs (see swingBucketBounds)
    // so a shade means the same swing magnitude on either side, not just within its own side.
    const { lossBounds, gainBounds } = swingBucketBounds(maxAbs);
    const stepExpr: unknown[] = ['step', valueExpr, SWING_BUCKET_COLORS[0]];
    lossBounds.forEach((bound, i) => stepExpr.push(bound, SWING_BUCKET_COLORS[i + 1]));
    stepExpr.push(0, SWING_BUCKET_COLORS[SWING_BUCKETS_PER_SIDE]);
    gainBounds.forEach((bound, i) => stepExpr.push(bound, SWING_BUCKET_COLORS[SWING_BUCKETS_PER_SIDE + 1 + i]));
    // Exact zero gets its own neutral color instead of falling into the lightest gain bucket.
    return noDataGuard(['case', ['==', valueExpr, 0], SWING_ZERO_COLOR, stepExpr]);
  }

  const rampColors = sequentialStops(yearColor(year ?? 0));

  if (metric === 'rank') {
    const ranks = Object.values(yearData.municipalities).map(m => m.rank);
    if (ranks.length === 0) return NO_DATA_COLOR as unknown as maplibregl.ExpressionSpecification;
    const maxRank = Math.max(...ranks);
    // Best rank (#1) = darkest step, worst = lightest — same ramp direction reversed
    const rankColors = [...rampColors].reverse();
    const stops: (string | number)[] = [];
    for (let i = 0; i < rankColors.length; i++) {
      const stop = Math.round(1 + FRACS[i] * (maxRank - 1));
      if (i > 0 && stop <= (stops[stops.length - 2] as number)) continue;
      stops.push(stop, rankColors[i]);
    }
    return noDataGuard(['interpolate', ['linear'], valueExpr, ...stops]);
  }

  // Fixed-scale stops: always span 0 → cap so colors are comparable across senators
  const cap = metric === 'vote_share' ? VOTE_SHARE_CAP : RAW_VOTES_CAP;
  const stops: (string | number)[] = [];
  for (let i = 0; i < rampColors.length; i++) {
    stops.push(cap * FRACS[i], rampColors[i]);
  }
  return noDataGuard(['interpolate', ['linear'], valueExpr, ...stops]);
}

function buildTooltipHtml(
  props: Record<string, unknown>,
  municipalityNames: MunicipalityNames,
  yearData: CandidateYearData | null,
  senatorId: string | null,
  metric: Metric,
  swingMap?: Map<string, SwingEntry> | null
): string {
  const name     = (props.adm3_en ?? props.name ?? '') as string;
  const psgc     = props.adm3_psgc as string;
  const province = municipalityNames[psgc]?.adm2_en ?? '';

  let detail = '';
  let detailColor = '#a1a1aa';
  if (metric === 'swing') {
    const entry = swingMap?.get(psgc);
    if (entry) {
      detail = `${formatSwingPt(entry.delta)} swing`;
      detailColor = swingColor(entry.delta);
    } else if (senatorId) {
      detail = 'No data';
    }
  } else {
    const m = yearData?.municipalities[psgc];
    if (m) {
      if (metric === 'vote_share') detail = `${(m.vote_share * 100).toFixed(1)}% vote share`;
      else if (metric === 'rank')  detail = `Rank #${m.rank}`;
      else                         detail = `${m.votes.toLocaleString()} votes`;
    } else if (senatorId) {
      detail = 'No data';
    }
  }

  return `
    <div style="font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.5;padding:6px 10px;min-width:130px">
      <div style="font-weight:600;color:#f4f4f5;margin-bottom:1px">${name}</div>
      ${province ? `<div style="color:#d4d4d8;font-size:12px;margin-bottom:3px">${province}</div>` : ''}
      ${detail ? `<div style="color:${detailColor};font-size:15px;font-weight:600">${detail}</div>` : ''}
    </div>`;
}

const METRIC_LABEL: Record<Metric, string> = {
  rank: 'Rank by municipality',
  vote_share: 'Vote share',
  votes: 'Raw votes',
  swing: 'Swing',
};

function formatLegendValue(metric: Metric, v: number): string {
  if (metric === 'rank') return `#${Math.round(v)}`;
  if (metric === 'vote_share' || metric === 'swing') return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return `${Math.round(v)}`;
}

// Legend gradient + min/max labels for the currently selected senator/metric.
// Mirrors the color logic in buildColorExpression so the legend always matches what's painted.
function buildLegend(
  yearData: CandidateYearData | null,
  senatorId: string | null,
  metric: Metric,
  year: number | null,
  swingMap?: Map<string, SwingEntry> | null
) {
  if (!senatorId) return null;

  if (metric === 'swing') {
    if (!swingMap || swingMap.size === 0) return null;
    const maxAbs = swingMaxAbs(swingMap);
    if (maxAbs === 0) return null;
    const { lossBounds, gainBounds } = swingBucketBounds(maxAbs);
    const { lossCounts, gainCounts, zeroCount } = swingBucketCounts(swingMap, lossBounds, gainBounds);
    // Bar order matches SWING_BUCKET_COLORS (strong loss -> mild loss -> mild gain -> strong
    // gain), with the zero-swing count inserted as its own center bar between the two sides.
    // lossCounts[0] is already the strong-loss (most negative) bucket — swingBucketCounts finds
    // the FIRST ascending bound a delta is less than, which the most extreme deltas hit first —
    // so it must NOT be reversed again here, or counts end up misaligned with SWING_LOSS_COLORS
    // (which IS reversed, since it's authored mild -> strong) and the mild-loss bucket's count
    // (usually the largest, since real swings cluster near zero) renders under the strong-loss
    // color/position, making the leftmost bar always look artificially tall.
    const counts = [...lossCounts, zeroCount, ...gainCounts];
    const colors = [...SWING_LOSS_COLORS.slice().reverse(), SWING_ZERO_COLOR, ...SWING_GAIN_COLORS];
    // Label shows the true shared maxAbs on both sides — honest now that both sides' buckets
    // are actually scaled to it (see swingBucketBounds); a lopsided histogram (e.g. losses
    // filling every bucket, gains only reaching the first one or two) is the correct picture
    // when one side's real swings are much larger than the other's, not a display bug.
    return {
      colors: SWING_BUCKET_COLORS,
      histogram: { colors, counts },
      minLabel: `−${(maxAbs * 100).toFixed(0)}pt`,
      maxLabel: `+${(maxAbs * 100).toFixed(0)}pt`,
      bestFirst: false,
      // Swing paints in 10 discrete step buckets, not a continuous ramp — the legend must
      // render as separate solid chips, not a blended gradient, or it misrepresents the
      // scale as smooth when adjacent municipalities can jump a whole bucket at once.
      discrete: true,
    };
  }

  if (!yearData) return null;
  const values = Object.values(yearData.municipalities).map(m =>
    metric === 'vote_share' ? m.vote_share : metric === 'rank' ? m.rank : m.votes
  );
  if (values.length === 0) return null;

  const rampColors = sequentialStops(yearColor(year ?? 0));

  if (metric === 'rank') {
    const maxRank = Math.max(...values);
    return {
      colors: [...rampColors].reverse(),
      histogram: undefined,
      minLabel: formatLegendValue('rank', 1),
      maxLabel: formatLegendValue('rank', maxRank),
      bestFirst: true,
      discrete: false,
    };
  }

  const cap = metric === 'vote_share' ? VOTE_SHARE_CAP : RAW_VOTES_CAP;
  const max = Math.min(Math.max(...values), cap);
  return {
    colors: rampColors,
    histogram: undefined,
    minLabel: formatLegendValue(metric, 0),
    maxLabel: `${max >= cap ? '≥' : ''}${formatLegendValue(metric, max)}`,
    bestFirst: false,
    discrete: false,
  };
}

function applyPaint(
  map: maplibregl.Map,
  yearData: CandidateYearData,
  metric: Metric,
  year: number | null,
  swingMap?: Map<string, SwingEntry> | null
) {
  map.setPaintProperty('municipalities-fill', 'fill-color',
    buildColorExpression(yearData, metric, year, swingMap));

  // Show hatch only on features where this senator has no data for the active metric
  const psgcsWithData = metric === 'swing'
    ? Array.from(swingMap?.keys() ?? [])
    : Object.keys(yearData.municipalities);

  // filter: psgc NOT in the with-data set → show hatch
  map.setFilter('municipalities-nodata',
    psgcsWithData.length > 0
      ? ['!', ['in', ['get', 'adm3_psgc'], ['literal', psgcsWithData]]]
      : ['boolean', true]
  );
}

export default function ChoroplethMap({ candidate, municipalityNames, senatorId, senatorName, year, metric, swingMap, swingYears, onNavigateToProfile, onChangeMetric }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const loadedRef     = useRef(false);
  const topoRef = useRef<{ topo: Topology; municitiesObj: GeometryCollection<{ adm1_pcode: string; adm2_pcode: string }> } | null>(null);
  const labelsBuiltRef  = useRef(false);
  const yearData = candidate && year !== null ? candidate.years[String(year)] ?? null : null;
  // Keep latest props accessible inside stable event handlers
  const propsRef      = useRef({ yearData, municipalityNames, senatorId, metric, year, swingMap });
  propsRef.current    = { yearData, municipalityNames, senatorId, metric, year, swingMap };
  // Drives the "reset view" button — only shown once the user has actually panned/zoomed away
  const [showResetButton, setShowResetButton] = useState(false);
  // Tracks "first interaction per candidate+year view" so map_interact fires once per view,
  // not on every pixel of pan — otherwise it's unusable for funnel analysis.
  const hasInteractedRef = useRef(false);
  const lastHoverTrackRef = useRef(0);

  // Init map + load topojson once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron',
      center: PH_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: DEFAULT_ZOOM,
      maxBounds: MAX_BOUNDS,
      // Always start collapsed to an "i" icon — expands as an overlay on click.
      // Default compact mode only auto-collapses under 640px container width,
      // which left it expanded (and blocking the legend) on wider map columns.
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // MapLibre's compact attribution starts visually expanded (native <details open>
    // + a "-show" class) the first time it computes attribution text — which happens
    // asynchronously once style/tile data loads, not synchronously on construction.
    // Force it closed on every recompute until the user opens it themselves.
    let userOpenedAttribution = false;
    function collapseAttribution() {
      if (userOpenedAttribution || !containerRef.current) return;
      const el = containerRef.current.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
      if (el) {
        el.classList.remove('maplibregl-compact-show');
        el.removeAttribute('open');
      }
    }
    collapseAttribution();
    map.on('data', collapseAttribution);
    map.on('styledata', collapseAttribution);
    map.on('resize', collapseAttribution);
    containerRef.current.addEventListener('click', e => {
      if ((e.target as HTMLElement)?.closest?.('.maplibregl-ctrl-attrib-button')) {
        userOpenedAttribution = true;
      }
    });

    // Show the reset button once the view has moved away from the default center/zoom
    map.on('moveend', () => {
      const center = map.getCenter();
      const moved =
        Math.abs(center.lng - PH_CENTER[0]) > 0.01 ||
        Math.abs(center.lat - PH_CENTER[1]) > 0.01 ||
        Math.abs(map.getZoom() - DEFAULT_ZOOM) > 0.01;
      setShowResetButton(moved);
    });

    // First interaction per candidate+year view — reset by the effect below whenever
    // senatorId/year changes, so repeated pans within the same view don't spam events.
    function trackFirstInteraction(interactionType: 'pan' | 'zoom' | 'drag') {
      if (hasInteractedRef.current) return;
      hasInteractedRef.current = true;
      const { senatorId, year } = propsRef.current;
      if (!senatorId || year === null) return;
      trackEvent('map_interact', { interaction_type: interactionType, candidate_id: senatorId, year });
    }
    map.on('dragstart', () => trackFirstInteraction('drag'));
    map.on('zoomstart', e => {
      // MapLibre fires zoomstart for both scroll-wheel/pinch zoom and the +/- button
      // clicks below; both count as "zoom" for this event's purposes.
      if (!e.originalEvent) return; // ignore programmatic zooms (e.g. reset-view flyTo)
      trackFirstInteraction('zoom');
    });

    map.on('load', async () => {
      // Bold font actually shipped by whichever basemap style is configured — different
      // providers ship different families (e.g. stamen_toner_lite serves "Inter Bold",
      // OpenFreeMap's Positron serves "Noto Sans Bold"), and a font name absent from the
      // style's glyphs endpoint fails silently with no text rendered at all. Detected here
      // from any basemap symbol layer's own text-font, so province labels always match a
      // font the current style actually has, whichever style is active.
      let boldFont = 'Noto Sans Bold';

      // Hide basemap labels and admin/boundary lines — keep only land & water fills
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type === 'symbol') {
          const font = map.getLayoutProperty(layer.id, 'text-font') as string[] | undefined;
          const bold = font?.find(f => /bold/i.test(f));
          if (bold) boldFont = bold;
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } else if (layer.type === 'line') {
          const src = (layer as maplibregl.LineLayerSpecification).source as string;
          // Only hide lines from the basemap source, not our own choropleth layers
          if (src !== 'ph-municipalities') {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        }
      }

      // Build a diagonal hatch pattern for no-data municipalities
      const patternSize = 5;
      const canvas = document.createElement('canvas');
      canvas.width = patternSize;
      canvas.height = patternSize;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#e4e4e7'; // zinc-200 background
      ctx.fillRect(0, 0, patternSize, patternSize);
      ctx.strokeStyle = '#a1a1aa'; // zinc-400 diagonal lines
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, patternSize);
      ctx.lineTo(patternSize, 0);
      ctx.stroke();
      // Second line to tile cleanly
      ctx.beginPath();
      ctx.moveTo(-patternSize, patternSize);
      ctx.lineTo(patternSize, -patternSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 2 * patternSize);
      ctx.lineTo(2 * patternSize, 0);
      ctx.stroke();
      map.addImage('no-data-hatch', { width: patternSize, height: patternSize, data: ctx.getImageData(0, 0, patternSize, patternSize).data });

      const res  = await fetch('/data/ph_municipalities.json');
      if (!res.ok) {
        trackEvent('data_fetch_error', { resource: 'municipalities_geo', error_type: `http_${res.status}` });
      }
      const topo: Topology = await res.json();
      const municitiesObj = topo.objects.municities as GeometryCollection<{ adm1_pcode: string; adm2_pcode: string }>;
      const geojson = feature(topo, municitiesObj);

      map.addSource('ph-municipalities', { type: 'geojson', data: geojson });

      // Group key used for the dissolved province boundary: adm2_pcode everywhere except
      // NCR, whose adm2_pcode values are internal "districts" that don't correspond to real
      // provinces (see NCR_REGION_PCODE above) — NCR is treated as one region instead, so
      // no boundary line is drawn between its cities.
      const provinceGroupKey = (props: { adm1_pcode?: string; adm2_pcode?: string } | undefined) =>
        props?.adm1_pcode === NCR_REGION_PCODE ? NCR_REGION_PCODE : props?.adm2_pcode;

      // Province outlines — dissolved from municipality boundaries (kept only where an arc
      // borders two different provinces/regions, or sits on the outer edge) so no separate
      // province geometry file is needed.
      const provinceMesh = mesh(topo, municitiesObj, (a, b) =>
        provinceGroupKey(a.properties as { adm1_pcode?: string; adm2_pcode?: string } | undefined) !==
        provinceGroupKey(b.properties as { adm1_pcode?: string; adm2_pcode?: string } | undefined)
      );

      map.addSource('ph-provinces', { type: 'geojson', data: provinceMesh });

      // Topology + geometry collection kept in case labels need rebuilding later (they don't,
      // since municipalityNames is available from mount — kept for parity/safety).
      topoRef.current = { topo, municitiesObj };

      labelsBuiltRef.current = true;
      map.addSource('ph-province-labels', {
        type: 'geojson',
        data: buildProvinceLabelPoints(topo, municitiesObj, propsRef.current.municipalityNames),
      });

      map.addLayer({
        id: 'municipalities-fill',
        type: 'fill',
        source: 'ph-municipalities',
        paint: { 'fill-color': NO_DATA_COLOR, 'fill-opacity': 0.85 },
      });

      // Hatched overlay — hidden by default, filter updated by applyPaint to show no-data features
      map.addLayer({
        id: 'municipalities-nodata',
        type: 'fill',
        source: 'ph-municipalities',
        filter: ['boolean', false],
        paint: { 'fill-pattern': 'no-data-hatch' },
      });

      // Mid-gray rather than black or white — a dark line disappeared into dark ramp fills
      // (e.g. top rank stops), and a light line would have the same problem against the
      // palest fills, so neither end-of-ramp color alone stays visible everywhere. Kept
      // thinner than the province line/halo so the province hierarchy still reads clearly.
      map.addLayer({
        id: 'municipalities-outline',
        type: 'line',
        source: 'ph-municipalities',
        paint: {
          'line-color': 'rgba(113,113,122,0.55)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 1.1],
        },
      });

      // Province boundaries — findable at a glance instead of drowning in hundreds of thin
      // municipal slivers. Drawn as a light halo + dark core so the line stays visible against
      // both the pale and near-black ends of the choropleth ramp — a single fixed color
      // disappears into dark fills (e.g. top rank stops), which a halo works around without
      // needing to sample the fill color under the line.
      map.addLayer({
        id: 'provinces-outline-halo',
        type: 'line',
        source: 'ph-provinces',
        paint: {
          'line-color': 'rgba(255,255,255,0.65)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.2, 10, 4],
        },
      });
      map.addLayer({
        id: 'provinces-outline',
        type: 'line',
        source: 'ph-provinces',
        paint: {
          'line-color': 'rgba(24,24,27,0.7)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.8],
        },
      });

      // Thin white highlight on hovered feature
      map.addLayer({
        id: 'municipalities-hover',
        type: 'line',
        source: 'ph-municipalities',
        paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': 1.2 },
        filter: ['==', ['get', 'adm3_psgc'], ''],
      });

      // Province labels — added last so they paint on top of every fill/line layer above
      // instead of being drawn under and then covered by them.
      map.addLayer({
        id: 'province-labels',
        type: 'symbol',
        source: 'ph-province-labels',
        minzoom: 6,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [boldFont],
          'text-transform': 'uppercase',
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 14],
          'text-letter-spacing': 0.06,
          'text-max-width': 8,
        },
        paint: {
          'text-color': 'rgba(24,24,27,0.95)',
          'text-halo-color': 'rgba(255,255,255,0.95)',
          'text-halo-width': 1.6,
        },
      });

      // Hover tooltip — inline dark style so it's immune to CSS var overrides
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '220px',
      });

      // Override MapLibre popup background via inline style on the element
      const HOVER_TRACK_THROTTLE_MS = 2000;
      map.on('mousemove', 'municipalities-fill', e => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = 'pointer';
        const { yearData, municipalityNames, senatorId, metric, swingMap } = propsRef.current;
        const props = e.features[0].properties as Record<string, unknown>;

        // Drive the hover-outline layer to this feature
        map.setFilter('municipalities-hover', ['==', ['get', 'adm3_psgc'], String(props.adm3_psgc ?? '')]);

        // Throttled — mousemove fires continuously, so this samples at most once every
        // HOVER_TRACK_THROTTLE_MS rather than tracking every pixel of cursor movement.
        const now = Date.now();
        if (senatorId && now - lastHoverTrackRef.current > HOVER_TRACK_THROTTLE_MS) {
          lastHoverTrackRef.current = now;
          const psgc = props.adm3_psgc as string | undefined;
          const hasData = metric === 'swing'
            ? !!(psgc && swingMap?.has(psgc))
            : !!(psgc && yearData?.municipalities[psgc]);
          const municipalityName = (props.adm3_en ?? props.name ?? 'unknown') as string;
          trackEvent('map_hover_municipality', {
            has_data: hasData, metric, candidate_id: senatorId, municipality: municipalityName,
          });
        }

        popup
          .setLngLat(e.lngLat)
          .setHTML(buildTooltipHtml(props, municipalityNames, yearData, senatorId, metric, swingMap))
          .addTo(map);

        // Force dark background after DOM insertion
        const el = popup.getElement();
        if (el) {
          const inner = el.querySelector<HTMLElement>('.maplibregl-popup-content');
          if (inner) {
            inner.style.background = '#27272a';
            inner.style.borderRadius = '8px';
            inner.style.padding = '0';
            inner.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
            inner.style.border = '1px solid #3f3f46';
          }
          const tip = el.querySelector<HTMLElement>('.maplibregl-popup-tip');
          if (tip) { tip.style.borderTopColor = '#27272a'; tip.style.borderBottomColor = '#27272a'; }
        }
      });

      map.on('mouseleave', 'municipalities-fill', () => {
        map.getCanvas().style.cursor = '';
        map.setFilter('municipalities-hover', ['==', ['get', 'adm3_psgc'], '']);
        popup.remove();
      });

      loadedRef.current = true;

      // Apply paint if data already loaded
      const { yearData, senatorId, metric, year, swingMap } = propsRef.current;
      if (yearData && senatorId) {
        applyPaint(map, yearData, metric, year, swingMap);
      }
    });

    return () => { map.remove(); loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-paint when senator / metric / yearData / year / swingMap changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !yearData || !senatorId) return;
    if (!map.getLayer('municipalities-fill')) return;
    applyPaint(map, yearData, metric, year, swingMap);
  }, [yearData, senatorId, metric, year, swingMap]);

  // New candidate+year view — allow map_interact to fire again for it.
  useEffect(() => {
    hasInteractedRef.current = false;
  }, [senatorId, year]);

  const legend = buildLegend(yearData, senatorId, metric, year, swingMap);
  const contextValue = metric === 'swing' && swingYears
    ? `${swingYears[0]} → ${swingYears[1]} · Swing`
    : `${year ?? '—'} · ${METRIC_LABEL[metric]}`;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Context strip — who/when/what is being shown, so the map is legible on its own.
          Doubles as a shortcut back to the candidate's profile (mobile only, when lost in the map). */}
      {senatorId && (
        onNavigateToProfile ? (
          <button
            onClick={onNavigateToProfile}
            title="Back to profile"
            aria-label="Back to profile"
            className="absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] flex items-center gap-1.5 bg-white/95 text-zinc-700 border border-zinc-200 shadow-sm rounded-lg pl-2 pr-3 py-2 hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="min-w-0 text-left">
              <p className="text-sm font-semibold leading-tight truncate">
                {senatorName ?? senatorId}
              </p>
              <p className="text-xs text-zinc-500 leading-tight mt-0.5">
                {contextValue}
              </p>
            </span>
          </button>
        ) : (
          <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] bg-white/95 text-zinc-700 border border-zinc-200 shadow-sm rounded-lg px-3 py-2">
            <p className="text-sm font-semibold leading-tight truncate">
              {senatorName ?? senatorId}
            </p>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">
              {contextValue}
            </p>
          </div>
        )
      )}

      {/* Zoom + reset — one aligned control stack instead of MapLibre's default control */}
      <div className="absolute top-3 right-3 z-10 flex flex-col rounded-lg bg-white/95 border border-zinc-200 shadow-sm overflow-hidden">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex items-center justify-center w-9 h-9 text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="h-px bg-zinc-200" />
        <button
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex items-center justify-center w-9 h-9 text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        {showResetButton && (
          <>
            <div className="h-px bg-zinc-200" />
            <button
              onClick={() => {
                trackEvent('map_reset_view', {});
                mapRef.current?.flyTo({ center: PH_CENTER, zoom: DEFAULT_ZOOM });
              }}
              title="Reset map view"
              aria-label="Reset map view"
              className="flex items-center justify-center w-9 h-9 text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Legend — color scale for the active metric, plus what the hatch pattern means */}
      {legend && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 text-zinc-700 border border-zinc-200 shadow-sm rounded-lg px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            {legend.histogram ? (
              // Mini histogram — bar height ∝ how many municipalities fall in that bucket,
              // so the legend doubles as a distribution summary, not just a color key.
              (() => {
                const maxCount = Math.max(1, ...legend.histogram.counts);
                return (
                  <div className="flex items-end w-24 h-6 gap-px">
                    {legend.histogram.colors.map((c, i) => {
                      const count = legend.histogram!.counts[i];
                      const pct = Math.max(count > 0 ? 12 : 4, (count / maxCount) * 100);
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-[1px]"
                          style={{ background: c, height: `${pct}%` }}
                          title={`${count} municipalit${count === 1 ? 'y' : 'ies'}`}
                        />
                      );
                    })}
                  </div>
                );
              })()
            ) : legend.discrete ? (
              <div className="flex w-24 h-2.5 rounded-full overflow-hidden gap-px">
                {legend.colors.map((c, i) => (
                  <div key={i} className="flex-1 h-full" style={{ background: c }} />
                ))}
              </div>
            ) : (
              <div
                className="w-24 h-2.5 rounded-full"
                style={{ background: `linear-gradient(to right, ${legend.colors.join(', ')})` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between w-24 text-[10px] text-zinc-500 leading-none">
            <span>{legend.minLabel}</span>
            <span>{legend.maxLabel}</span>
          </div>
          {legend.bestFirst && (
            <p className="text-[10px] text-zinc-400 leading-tight">Left = best rank</p>
          )}
          <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-200">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #e4e4e7 0, #e4e4e7 1.5px, #a1a1aa 1.5px, #a1a1aa 2px, #e4e4e7 2px, #e4e4e7 3.5px)',
              }}
            />
            <span className="text-[10px] text-zinc-500 leading-none">No data recorded</span>
          </div>
        </div>
      )}

      {!senatorId && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm bg-white/90 text-zinc-600 px-4 py-2 rounded-lg border border-zinc-200 shadow-sm">
            Select a candidate to see the choropleth
          </p>
        </div>
      )}

      {senatorId && metric === 'swing' && (!swingMap || swingMap.size === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
          <div className="text-sm text-center bg-white/90 text-zinc-600 px-4 py-2 rounded-lg border border-zinc-200 shadow-sm max-w-xs pointer-events-auto">
            <p>Swing values are only available for candidates who ran in 2 or more elections.</p>
            {onChangeMetric && (
              <p className="mt-1">
                See the{' '}
                <button type="button" onClick={() => onChangeMetric('rank')} className="text-blue-700 font-medium underline underline-offset-2 hover:no-underline">
                  rank
                </button>
                ,{' '}
                <button type="button" onClick={() => onChangeMetric('vote_share')} className="text-blue-700 font-medium underline underline-offset-2 hover:no-underline">
                  vote share
                </button>
                {' '}or{' '}
                <button type="button" onClick={() => onChangeMetric('votes')} className="text-blue-700 font-medium underline underline-offset-2 hover:no-underline">
                  raw votes
                </button>
                {' '}view instead.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
