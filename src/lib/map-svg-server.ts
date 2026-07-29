import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// Server-only: decodes the same ph_municipalities.json topology ChoroplethMap.tsx renders
// client-side with MapLibre, but into plain SVG path strings — next/og's Satori renderer has
// no WebGL/MapLibre, so the static map-share OG image needs its polygons pre-projected here.

const dataDir = path.join(process.cwd(), 'public', 'data');

type MunicipalityProps = { adm3_psgc: string; adm2_pcode: string };

// Kalayaan (Palawan's Spratly Islands municipality) sits ~500km west of mainland Palawan —
// including it in the crop's bounding box drags minLng far enough west that the actual
// visually-dense archipelago gets shoved off-center and clipped by 'cover' fit. Standard
// practice for maps of the Philippines is to omit or inset the Spratlys rather than let them
// set the frame; here it's simplest to just exclude this one municipality from the bbox math
// (it's still rendered — just doesn't get to stretch the crop).
const BBOX_EXCLUDED_ADM2_PCODES = new Set(['PH17053']);

let topoPromise: Promise<Topology> | undefined;
function loadMunicipalitiesTopology(): Promise<Topology> {
  if (!topoPromise) {
    topoPromise = readFile(path.join(dataDir, 'ph_municipalities.json'), 'utf-8').then(raw => JSON.parse(raw));
  }
  return topoPromise;
}

export type MunicipalityPath = {
  psgc: string;
  /** SVG path `d` attribute, already projected into the shared viewBox below. */
  d: string;
};

export type MunicipalityPathSet = {
  paths: MunicipalityPath[];
  /** viewBox width/height — paths are projected to fit exactly within [0, width] x [0, height]. */
  width: number;
  height: number;
};

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

// Equirectangular (plate carrée) projection rather than Mercator — the Philippines' latitude
// span (~4.6°-21.1°N) is narrow enough that Mercator's extra north-south stretch is barely
// perceptible here, and a straight lng/lat -> x/y scale avoids trig entirely for a one-off
// static render that never needs to be zoomed/panned like the live MapLibre map.
function project(
  lng: number,
  lat: number,
  bounds: Bounds,
  fitWidth: number,
  fitHeight: number,
  offsetX: number,
  offsetY: number
): [number, number] {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * fitWidth + offsetX;
  // SVG y grows downward; latitude grows northward — flip so north renders at the top.
  const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * fitHeight + offsetY;
  return [Math.round(x), Math.round(y)];
}

// Douglas-Peucker simplification in already-projected pixel space — the raw topology has ~686k
// arc points total, which produced an SVG payload large enough to blow Satori's underlying XML
// parser buffer ("Resource limit exceeded... try XML_PARSE_HUGE") when rendered at full detail.
// A 760x534 thumbnail has no use for sub-pixel coastline wiggles, so simplifying in pixel space
// (tolerance in actual rendered pixels, not lng/lat degrees) directly targets the resolution
// that's actually visible, and collapses to nothing extra work for image quality.
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points;

  function sqDistToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
    let [x, y] = a;
    const dx = b[0] - x;
    const dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    const ddx = p[0] - x;
    const ddy = p[1] - y;
    return ddx * ddx + ddy * ddy;
  }

  function simplifySection(pts: [number, number][], first: number, last: number, sqTolerance: number, out: boolean[]): void {
    let maxSqDist = sqTolerance;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const sqDist = sqDistToSegment(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
    }
    if (index !== -1) {
      out[index] = true;
      if (index - first > 1) simplifySection(pts, first, index, sqTolerance, out);
      if (last - index > 1) simplifySection(pts, index, last, sqTolerance, out);
    }
  }

  const sqTolerance = tolerance * tolerance;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifySection(points, 0, points.length - 1, sqTolerance, keep);
  return points.filter((_, i) => keep[i]);
}

function ringToPath(
  ring: number[][],
  bounds: Bounds,
  fitWidth: number,
  fitHeight: number,
  offsetX: number,
  offsetY: number
): string {
  const projected = ring.map(([lng, lat]) => project(lng, lat, bounds, fitWidth, fitHeight, offsetX, offsetY));
  // 0.75px tolerance — fine enough that province/municipality shapes stay recognizable at this
  // thumbnail size, coarse enough to cut the point count (and resulting SVG size) by ~95%.
  const simplified = simplify(projected, 0.75);
  return simplified.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + 'Z';
}

function geometryToPath(
  geom: Polygon | MultiPolygon,
  bounds: Bounds,
  fitWidth: number,
  fitHeight: number,
  offsetX: number,
  offsetY: number
): string {
  const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polygons
    .map(rings => rings.map(ring => ringToPath(ring, bounds, fitWidth, fitHeight, offsetX, offsetY)).join(' '))
    .join(' ');
}

// Renders every municipality polygon as an SVG path, projected against the `width` x `height`
// box. `fit: 'contain'` (default) preserves the true lng/lat aspect ratio and letterboxes
// inside the box (no distortion, some empty margin). `fit: 'cover'` instead scales UP until
// the box is filled edge-to-edge on both axes, letting the map overflow past the taller/wider
// side — the caller must clip with `overflow: hidden` on the SVG's container, same idea as
// CSS `background-size: cover` vs. `contain`.
export async function buildMunicipalityPaths(
  width: number,
  height: number,
  fit: 'contain' | 'cover' = 'contain'
): Promise<MunicipalityPathSet> {
  const topo = await loadMunicipalitiesTopology();
  const municitiesObj = topo.objects.municities as GeometryCollection<MunicipalityProps>;
  const geojson = feature(topo, municitiesObj) as unknown as { features: Feature<Polygon | MultiPolygon, MunicipalityProps>[] };

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of geojson.features) {
    if (BBOX_EXCLUDED_ADM2_PCODES.has(f.properties.adm2_pcode)) continue;
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  const bounds: Bounds = { minLng, maxLng, minLat, maxLat };

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;
  const boxAspect = width / height;
  const geoAspect = lngSpan / latSpan;
  // 'contain': scale to the SMALLER of width/height-derived scales (fits inside, may leave
  // margin). 'cover': scale to the LARGER of the two (fills the box, may overflow) — the two
  // conditions are simply flipped versions of each other.
  const useWidthAsIs = fit === 'contain' ? geoAspect > boxAspect : geoAspect <= boxAspect;
  const fitWidth = useWidthAsIs ? width : height * geoAspect;
  const fitHeight = useWidthAsIs ? width / geoAspect : height;
  const offsetX = (width - fitWidth) / 2;
  const offsetY = (height - fitHeight) / 2;

  const paths: MunicipalityPath[] = geojson.features.map(f => ({
    psgc: f.properties.adm3_psgc,
    d: geometryToPath(f.geometry, bounds, fitWidth, fitHeight, offsetX, offsetY),
  }));

  return { paths, width, height };
}
