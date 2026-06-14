'use client';
import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { VoteData, Metric } from '@/lib/types';

type Props = {
  voteData: VoteData | null;
  senatorId: string | null;
  metric: Metric;
};

const PH_CENTER: [number, number] = [122, 12.8];
const DEFAULT_ZOOM = 5;
const NO_DATA_COLOR = '#d4d4d8'; // light neutral — blends into toner_lite's land

// Muted sequential: pale yellow → sage green → slate blue (pastel, not neon)
const SEQ_STOPS = {
  colors: ['#fef9c3', '#bbf7d0', '#6ee7b7', '#38bdf8', '#1d4ed8'],
  fracs:  [0,          0.25,      0.5,       0.75,      1],
};

// Rank: rank #1 (best) = deep blue, last = pale yellow
const RANK_STOPS = {
  colors: ['#1d4ed8', '#38bdf8', '#6ee7b7', '#bbf7d0', '#fef9c3'],
  fracs:  [0,          0.25,      0.5,       0.75,      1],
};

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
  metric: Metric
): maplibregl.ExpressionSpecification {
  const valueExpr = buildMatchExpression(voteData, senatorId, metric);
  // Wrap with case: sentinel → NO_DATA_COLOR, otherwise → interpolated color
  const noDataGuard = (colorExpr: unknown) =>
    ['case', ['==', valueExpr, NO_DATA_SENTINEL], NO_DATA_COLOR, colorExpr] as unknown as maplibregl.ExpressionSpecification;

  if (metric === 'rank') {
    const ranks = Object.values(voteData.municipalities).flatMap(m =>
      m.candidates.find(c => c.senator_id === senatorId)?.rank ?? []
    );
    if (ranks.length === 0) return NO_DATA_COLOR as unknown as maplibregl.ExpressionSpecification;
    const maxRank = Math.max(...ranks);
    const stops: (string | number)[] = [];
    for (let i = 0; i < RANK_STOPS.colors.length; i++) {
      const stop = Math.round(1 + RANK_STOPS.fracs[i] * (maxRank - 1));
      if (i > 0 && stop <= (stops[stops.length - 2] as number)) continue;
      stops.push(stop, RANK_STOPS.colors[i]);
    }
    return noDataGuard(['interpolate', ['linear'], valueExpr, ...stops]);
  }

  // Fixed-scale stops: always span 0 → cap so colors are comparable across senators
  const cap = metric === 'vote_share' ? VOTE_SHARE_CAP : RAW_VOTES_CAP;
  const stops: (string | number)[] = [];
  for (let i = 0; i < SEQ_STOPS.colors.length; i++) {
    stops.push(cap * SEQ_STOPS.fracs[i], SEQ_STOPS.colors[i]);
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

function applyPaint(map: maplibregl.Map, voteData: VoteData, senatorId: string, metric: Metric) {
  map.setPaintProperty('municipalities-fill', 'fill-color',
    buildColorExpression(voteData, senatorId, metric));

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

export default function ChoroplethMap({ voteData, senatorId, metric }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const loadedRef     = useRef(false);
  // Keep latest props accessible inside stable event handlers
  const propsRef      = useRef({ voteData, senatorId, metric });
  propsRef.current    = { voteData, senatorId, metric };

  // Init map + load topojson once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron',
      center: PH_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;

    map.on('load', async () => {
      // Hide basemap labels and admin/boundary lines — keep only land & water fills
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type === 'symbol') {
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
      const patternSize = 8;
      const canvas = document.createElement('canvas');
      canvas.width = patternSize;
      canvas.height = patternSize;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#e4e4e7'; // zinc-200 background
      ctx.fillRect(0, 0, patternSize, patternSize);
      ctx.strokeStyle = '#a1a1aa'; // zinc-400 diagonal lines
      ctx.lineWidth = 1;
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
      const geojson = feature(topo, topo.objects.municities as Parameters<typeof feature>[1]);

      map.addSource('ph-municipalities', { type: 'geojson', data: geojson });

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

      map.addLayer({
        id: 'municipalities-outline',
        type: 'line',
        source: 'ph-municipalities',
        paint: { 'line-color': 'rgba(0,0,0,0.15)', 'line-width': 0.4 },
      });

      // Thin white highlight on hovered feature
      map.addLayer({
        id: 'municipalities-hover',
        type: 'line',
        source: 'ph-municipalities',
        paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': 1.2 },
        filter: ['==', ['get', 'adm3_psgc'], ''],
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
      const { voteData, senatorId, metric } = propsRef.current;
      if (voteData && senatorId) {
        applyPaint(map, voteData, senatorId, metric);
      }
    });

    return () => { map.remove(); loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-paint when senator / metric / voteData changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !voteData || !senatorId) return;
    if (!map.getLayer('municipalities-fill')) return;
    applyPaint(map, voteData, senatorId, metric);
  }, [voteData, senatorId, metric]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
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
