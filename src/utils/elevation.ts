import { elevation } from '@maptiler/sdk';
import type { LineString } from 'geojson';

export type ElevationResult = {
  coordinates: [number, number, number][];
  gain: number;
  loss: number;
};

/**
 * Add altitude (m) to each coordinate of `geometry`, server-side.
 * Returns null when the elevation service is unavailable — callers
 * should still render the route without elevation data.
 */
export async function addElevation(geometry: LineString): Promise<ElevationResult | null> {
  try {
    const result = await elevation.fromLineString(geometry, { computeOn: 'server' });
    const coords = result.coordinates as [number, number, number][];
    return { coordinates: coords, ...computeElevationStats(coords) };
  } catch (e) {
    console.warn('Elevation data unavailable:', e);
    return null;
  }
}

/** Cumulative gain/loss (m) from altitude-tagged coordinates. */
export function computeElevationStats(coords: [number, number, number][]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < coords.length; i++) {
    const diff = coords[i][2] - coords[i - 1][2];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}
