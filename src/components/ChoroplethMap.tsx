'use client';
import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature, mesh, merge } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { ChevronLeft, Home, Plus, Minus } from 'lucide-react';
import type { VoteData, Metric } from '@/lib/types';
import { yearColor } from '@/lib/year-colors';

type Props = {
  voteData: VoteData | null;
  senatorId: string | null;
  senatorName: string | null;
  year: number | null;
  metric: Metric;
  onNavigateToProfile?: () => void;
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
// of the whole shape. Names come from voteData (already resolved adm2_en per municipality
// by the data pipeline) rather than duplicating the PSGC→name lookup table client-side;
// adm3_psgc is the join key shared between the topojson and voteData.
function buildProvinceLabelPoints(
  topo: Topology,
  municitiesObj: GeometryCollection<{ adm1_pcode: string; adm2_pcode: string }>,
  voteData: VoteData
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
      const name = isNcr ? NCR_LABEL : voteData.municipalities[psgc]?.adm2_en;
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

function buildMatchExpression(
  voteData: VoteData,
  senatorId: string,
  metric: Metric
): maplibregl.ExpressionSpecification {
  const pairs: (string | number)[] = [];
  for (const [psgc, mun] of Object.entries(voteData.municipalities)) {
    const c = mun.candidates.find(c => c.senator_id === senatorId);
    if (!c) continue;
    let val: number;
    if (metric === 'vote_share') val = Math.min(c.vote_share, VOTE_SHARE_CAP);
    else if (metric === 'rank')  val = c.rank;
    else                         val = Math.min(c.votes, RAW_VOTES_CAP);
    pairs.push(psgc, val);
  }
  // Fallback -1 signals "no data" — real values are always >= 0
  return ['match', ['get', 'adm3_psgc'], ...pairs, NO_DATA_SENTINEL] as unknown as maplibregl.ExpressionSpecification;
}

function buildColorExpression(
  voteData: VoteData,
  senatorId: string,
  metric: Metric,
  year: number | null
): maplibregl.ExpressionSpecification {
  const valueExpr = buildMatchExpression(voteData, senatorId, metric);
  // Wrap with case: sentinel → NO_DATA_COLOR, otherwise → interpolated color
  const noDataGuard = (colorExpr: unknown) =>
    ['case', ['==', valueExpr, NO_DATA_SENTINEL], NO_DATA_COLOR, colorExpr] as unknown as maplibregl.ExpressionSpecification;

  const rampColors = sequentialStops(yearColor(year ?? 0));

  if (metric === 'rank') {
    const ranks = Object.values(voteData.municipalities).flatMap(m =>
      m.candidates.find(c => c.senator_id === senatorId)?.rank ?? []
    );
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

function buildTooltipHtml(props: Record<string, unknown>, voteData: VoteData | null, senatorId: string | null, metric: Metric): string {
  const name     = (props.adm3_en ?? props.name ?? '') as string;
  const psgc     = props.adm3_psgc as string;
  const mun      = voteData?.municipalities[psgc];
  const province = mun?.adm2_en ?? '';
  const c        = mun?.candidates.find(c => c.senator_id === senatorId);

  let detail = '';
  if (c) {
    if (metric === 'vote_share') detail = `${(c.vote_share * 100).toFixed(1)}% vote share`;
    else if (metric === 'rank')  detail = `Rank #${c.rank}`;
    else                         detail = `${c.votes.toLocaleString()} votes`;
  } else if (senatorId) {
    detail = 'No data';
  }

  return `
    <div style="font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.5;padding:6px 10px;min-width:130px">
      <div style="font-weight:600;color:#f4f4f5;margin-bottom:1px">${name}</div>
      ${province ? `<div style="color:#d4d4d8;font-size:12px;margin-bottom:3px">${province}</div>` : ''}
      ${detail ? `<div style="color:#a1a1aa;font-size:15px;font-weight:600">${detail}</div>` : ''}
    </div>`;
}

const METRIC_LABEL: Record<Metric, string> = {
  rank: 'Rank by municipality',
  vote_share: 'Vote share',
  votes: 'Raw votes',
};

function formatLegendValue(metric: Metric, v: number): string {
  if (metric === 'rank') return `#${Math.round(v)}`;
  if (metric === 'vote_share') return `${(v * 100).toFixed(0)}%`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return `${Math.round(v)}`;
}

// Legend gradient + min/max labels for the currently selected senator/metric.
// Mirrors the color logic in buildColorExpression so the legend always matches what's painted.
function buildLegend(voteData: VoteData | null, senatorId: string | null, metric: Metric, year: number | null) {
  if (!voteData || !senatorId) return null;

  const values = Object.values(voteData.municipalities).flatMap(m => {
    const c = m.candidates.find(c => c.senator_id === senatorId);
    return c ? [metric === 'vote_share' ? c.vote_share : metric === 'rank' ? c.rank : c.votes] : [];
  });
  if (values.length === 0) return null;

  const rampColors = sequentialStops(yearColor(year ?? 0));

  if (metric === 'rank') {
    const maxRank = Math.max(...values);
    return {
      colors: [...rampColors].reverse(),
      minLabel: formatLegendValue('rank', 1),
      maxLabel: formatLegendValue('rank', maxRank),
      bestFirst: true,
    };
  }

  const cap = metric === 'vote_share' ? VOTE_SHARE_CAP : RAW_VOTES_CAP;
  const max = Math.min(Math.max(...values), cap);
  return {
    colors: rampColors,
    minLabel: formatLegendValue(metric, 0),
    maxLabel: `${max >= cap ? '≥' : ''}${formatLegendValue(metric, max)}`,
    bestFirst: false,
  };
}

function applyPaint(map: maplibregl.Map, voteData: VoteData, senatorId: string, metric: Metric, year: number | null) {
  map.setPaintProperty('municipalities-fill', 'fill-color',
    buildColorExpression(voteData, senatorId, metric, year));

  // Show hatch only on features where this senator has no data
  const psgcsWithData = Object.entries(voteData.municipalities)
    .filter(([, mun]) => mun.candidates.some(c => c.senator_id === senatorId))
    .map(([psgc]) => psgc);

  // filter: psgc NOT in the with-data set → show hatch
  map.setFilter('municipalities-nodata',
    psgcsWithData.length > 0
      ? ['!', ['in', ['get', 'adm3_psgc'], ['literal', psgcsWithData]]]
      : ['boolean', true]
  );
}

export default function ChoroplethMap({ voteData, senatorId, senatorName, year, metric, onNavigateToProfile }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const loadedRef     = useRef(false);
  const topoRef = useRef<{ topo: Topology; municitiesObj: GeometryCollection<{ adm1_pcode: string; adm2_pcode: string }> } | null>(null);
  const labelsBuiltRef  = useRef(false);
  // Keep latest props accessible inside stable event handlers
  const propsRef      = useRef({ voteData, senatorId, metric, year });
  propsRef.current    = { voteData, senatorId, metric, year };
  // Drives the "reset view" button — only shown once the user has actually panned/zoomed away
  const [showResetButton, setShowResetButton] = useState(false);

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

      // Topology + geometry collection kept for building province labels once voteData
      // (which supplies adm2_en names) is available — may not be loaded yet on first mount.
      topoRef.current = { topo, municitiesObj };

      const initialVoteData = propsRef.current.voteData;
      if (initialVoteData) labelsBuiltRef.current = true;
      map.addSource('ph-province-labels', {
        type: 'geojson',
        data: initialVoteData
          ? buildProvinceLabelPoints(topo, municitiesObj, initialVoteData)
          : { type: 'FeatureCollection', features: [] },
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
      map.on('mousemove', 'municipalities-fill', e => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = 'pointer';
        const { voteData, senatorId, metric } = propsRef.current;
        const props = e.features[0].properties as Record<string, unknown>;

        // Drive the hover-outline layer to this feature
        map.setFilter('municipalities-hover', ['==', ['get', 'adm3_psgc'], String(props.adm3_psgc ?? '')]);

        popup
          .setLngLat(e.lngLat)
          .setHTML(buildTooltipHtml(props, voteData, senatorId, metric))
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
      const { voteData, senatorId, metric, year } = propsRef.current;
      if (voteData && senatorId) {
        applyPaint(map, voteData, senatorId, metric, year);
      }
    });

    return () => { map.remove(); loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-paint when senator / metric / voteData / year changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !voteData || !senatorId) return;
    if (!map.getLayer('municipalities-fill')) return;
    applyPaint(map, voteData, senatorId, metric, year);
  }, [voteData, senatorId, metric, year]);

  // Province labels don't depend on a selected candidate, only on voteData being loaded
  // (it supplies adm2_en names) — build them once, as soon as both are ready, independent
  // of whether the map or voteData finished loading first.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !voteData || labelsBuiltRef.current) return;
    const source = map.getSource('ph-province-labels') as maplibregl.GeoJSONSource | undefined;
    const loaded = topoRef.current;
    if (!source || !loaded) return;
    source.setData(buildProvinceLabelPoints(loaded.topo, loaded.municitiesObj, voteData));
    labelsBuiltRef.current = true;
  }, [voteData]);

  const legend = buildLegend(voteData, senatorId, metric, year);

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
                {year ?? '—'} · {METRIC_LABEL[metric]}
              </p>
            </span>
          </button>
        ) : (
          <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] bg-white/95 text-zinc-700 border border-zinc-200 shadow-sm rounded-lg px-3 py-2">
            <p className="text-sm font-semibold leading-tight truncate">
              {senatorName ?? senatorId}
            </p>
            <p className="text-xs text-zinc-500 leading-tight mt-0.5">
              {year ?? '—'} · {METRIC_LABEL[metric]}
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
              onClick={() => mapRef.current?.flyTo({ center: PH_CENTER, zoom: DEFAULT_ZOOM })}
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
            <div
              className="w-24 h-2.5 rounded-full"
              style={{ background: `linear-gradient(to right, ${legend.colors.join(', ')})` }}
            />
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
    </div>
  );
}
