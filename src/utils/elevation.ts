import { elevation } from '@maptiler/sdk'
import type { ElevCoord, LineString } from '../types/route'

export interface ElevationResult {
  coords: ElevCoord[]
  gain: number
  loss: number
}

export function computeElevationStats(coords: ElevCoord[]): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  for (let i = 1; i < coords.length; i++) {
    const diff = coords[i][2] - coords[i - 1][2]
    if (diff > 0) gain += diff
    else loss += Math.abs(diff)
  }
  return { gain: Math.round(gain), loss: Math.round(loss) }
}

export async function attachElevation(geojson: LineString): Promise<ElevationResult | null> {
  try {
    const elevated = await elevation.fromLineString(geojson, { computeOn: 'server' })
    const coords = elevated.coordinates as unknown as ElevCoord[]
    const { gain, loss } = computeElevationStats(coords)
    return { coords, gain, loss }
  } catch {
    return null
  }
}
