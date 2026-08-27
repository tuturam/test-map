import type { LngLat } from '../types/route'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * sinLng * sinLng
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function destinationPoint(
  [lng, lat]: LngLat,
  bearingDeg: number,
  distanceKm: number
): LngLat {
  const delta = distanceKm / EARTH_RADIUS_KM
  const theta = (bearingDeg * Math.PI) / 180
  const phi1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    )

  return [(lng2 * 180) / Math.PI, (phi2 * 180) / Math.PI]
}

export function bearingDeg(a: LngLat, b: LngLat): number {
  const phi1 = (a[1] * Math.PI) / 180
  const phi2 = (b[1] * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const CARDINALS = [
  'North',
  'Northeast',
  'East',
  'Southeast',
  'South',
  'Southwest',
  'West',
  'Northwest',
]

export function cardinalDirection(bearing: number): string {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8
  return CARDINALS[index]
}

export function centroid(points: LngLat[]): LngLat {
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length
  return [lng, lat]
}

export function computeBounds(coords: [number, number][]): [number, number, number, number] {
  let west = 180
  let south = 90
  let east = -180
  let north = -90
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [west, south, east, north]
}

export function generateLoopWaypoints(
  center: LngLat,
  radiusKm: number,
  baseOffsetDeg: number
): LngLat[] {
  const waypoints: LngLat[] = []
  for (let i = 0; i < 3; i++) {
    const angle = ((baseOffsetDeg + i * 120 + (Math.random() - 0.5) * 10) % 360 + 360) % 360
    const distance = radiusKm * (0.6 + Math.random() * 0.4)
    waypoints.push(destinationPoint(center, angle, distance))
  }
  return waypoints
}

export function generateLinearWaypoint(
  center: LngLat,
  targetDistanceKm: number,
  slot: number
): LngLat {
  const bearing = slot * 120 + 30 + Math.random() * 60
  return destinationPoint(center, bearing, targetDistanceKm * 0.8)
}

export function minPairwiseKm(groups: LngLat[][]): number {
  let min = Infinity
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const distance = haversineKm(centroid(groups[i]), centroid(groups[j]))
      if (distance < min) min = distance
    }
  }
  return min
}
