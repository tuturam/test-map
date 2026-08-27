import type {
  GeneratePayload,
  LineString,
  LngLat,
  RouteOption,
  RouteProfile,
  RouteType,
} from '../types/route'
import {
  bearingDeg,
  cardinalDirection,
  centroid,
  generateLinearWaypoint,
  generateLoopWaypoints,
  haversineKm,
} from '../utils/math'
import { osrmRoute, RoutingError } from '../utils/osrm'
import { attachElevation } from '../utils/elevation'

const SLOT_OFFSETS = [0, 40, 80]
const MIN_SEPARATION_KM = 1.5
const PACE_MIN_PER_KM: Record<RouteProfile, number> = { footing: 6, cycling: 4 }
const GAP_ACCEPTED = 0.4
const SCALE_CLAMP = { min: 0.4, max: 2 }

export async function generateRoutes(
  payload: GeneratePayload,
  referencePoint: LngLat
): Promise<RouteOption[]> {
  const baseSets = buildDiverseWaypoints(referencePoint, payload)

  const results = await Promise.all(
    baseSets.map((waypoints, index) =>
      buildOption(payload, referencePoint, waypoints, SLOT_OFFSETS[index])
    )
  )

  const options = results.filter((option): option is RouteOption => option !== null)
  if (options.length === 0) {
    throw new RoutingError('no-route', 'No route could be generated here')
  }
  return options
}

async function buildOption(
  payload: GeneratePayload,
  center: LngLat,
  baseWaypoints: LngLat[],
  offsetDeg: number
): Promise<RouteOption | null> {
  let best: { distanceKm: number; geojson: LineString; waypoints: LngLat[] } | null = null
  let bestGap = Infinity

  for (let attempt = 0; attempt < 2; attempt++) {
    let routePoints: LngLat[]
    try {
      if (attempt === 0) {
        routePoints = withStartEnd(center, baseWaypoints, payload.routeType)
      } else {
        if (!best) break
        const scale = Math.min(
          SCALE_CLAMP.max,
          Math.max(SCALE_CLAMP.min, payload.targetDistanceKm / best.distanceKm)
        )
        routePoints = withStartEnd(
          center,
          scaleWaypoints(center, best.waypoints, scale),
          payload.routeType
        )
      }
      const { geojson, distanceKm } = await osrmRoute(payload.profile, routePoints)
      const gap = Math.abs(distanceKm / payload.targetDistanceKm - 1)
      if (gap < bestGap) {
        const waypoints =
          payload.routeType === 'linear'
            ? [routePoints[routePoints.length - 1]]
            : routePoints.slice(1, 4)
        best = { distanceKm, geojson, waypoints }
        bestGap = gap
      }
      if (gap <= GAP_ACCEPTED) break
    } catch {
      if (attempt === 1 && best) break
    }
  }

  if (!best) return null

  const { distanceKm, geojson, waypoints } = best
  const elevation = await attachElevation(geojson)
  const geojsonWithAlt: LineString = elevation
    ? { ...geojson, coordinates: elevation.coords }
    : geojson
  const direction = cardinalDirection(bearingDeg(center, waypoints[0]))
  return {
    id: `route-${(offsetDeg / 40) % 3 + 1}`,
    direction,
    distanceKm,
    elevationGain: elevation?.gain ?? null,
    elevationLoss: elevation?.loss ?? null,
    estimatedTimeMin: Math.round(distanceKm * PACE_MIN_PER_KM[payload.profile]),
    geojson: geojsonWithAlt,
    waypoints,
    hasElevation: elevation !== null,
  } satisfies RouteOption
}

function buildDiverseWaypoints(center: LngLat, payload: GeneratePayload): LngLat[][] {
  const sets: LngLat[][] = []
  for (const offset of SLOT_OFFSETS) {
    let set = makeWaypoints(center, payload, offset)
    let guard = 0
    while (
      guard < 3 &&
      sets.some((other) => haversineKm(centroid(set), centroid(other)) < MIN_SEPARATION_KM)
    ) {
      guard++
      set = makeWaypoints(center, payload, offset + guard * 15)
    }
    sets.push(set)
  }
  return sets
}

function scaleWaypoints(center: LngLat, waypoints: LngLat[], scale: number): LngLat[] {
  return waypoints.map(([lng, lat]) => [
    center[0] + (lng - center[0]) * scale,
    center[1] + (lat - center[1]) * scale,
  ])
}

function withStartEnd(center: LngLat, waypoints: LngLat[], routeType: RouteType): LngLat[] {
  return routeType === 'linear' ? [center, ...waypoints] : [center, ...waypoints, center]
}

function makeWaypoints(
  center: LngLat,
  payload: GeneratePayload,
  offsetDeg: number,
  distanceScale = 1
): LngLat[] {
  if (payload.routeType === 'linear') {
    const slot = Math.round(offsetDeg / 40) % 3
    return [generateLinearWaypoint(center, payload.targetDistanceKm * distanceScale, slot)]
  }
  const loopRadiusKm = payload.targetDistanceKm * 0.2 * distanceScale
  return generateLoopWaypoints(center, loopRadiusKm, offsetDeg)
}
