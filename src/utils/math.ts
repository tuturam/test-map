import type { LngLat } from '../types/route';

const EARTH_RADIUS_KM = 6371;

/** Distance between two points in km (haversine). */
export function haversine(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Point at `bearingDeg` (0=north, 90=east) and `distanceKm` from origin.
 */
export function destinationPoint(
  origin: LngLat,
  bearingDeg: number,
  distanceKm: number,
): LngLat {
  const [lng, lat] = origin;
  const dR = distanceKm / EARTH_RADIUS_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(dR) +
      Math.cos(φ1) * Math.sin(dR) * Math.cos(θ),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(dR) * Math.cos(φ1),
      Math.cos(dR) - Math.sin(φ1) * Math.sin(φ2),
    );

  return [lng2 * (180 / Math.PI), φ2 * (180 / Math.PI)];
}

/**
 * `count` waypoints evenly spread around `center` at `radiusKm`,
 * with ±30° jitter and 60%-100% radius distance per waypoint.
 */
export function generateWaypointsForLoop(
  center: LngLat,
  radiusKm: number,
  count = 3,
): LngLat[] {
  const waypoints: LngLat[] = [];
  for (let i = 0; i < count; i++) {
    const baseAngle = (360 / count) * i;
    const jitter = (Math.random() - 0.5) * 60;
    const angle = (baseAngle + jitter + 360) % 360;
    const distance = radiusKm * (0.6 + Math.random() * 0.4);
    waypoints.push(destinationPoint(center, angle, distance));
  }
  return waypoints;
}

/** Single waypoint at `targetDistanceKm` in a random direction. */
export function generateWaypointForLinear(
  center: LngLat,
  targetDistanceKm: number,
): LngLat {
  const randomBearing = Math.random() * 360;
  return destinationPoint(center, randomBearing, targetDistanceKm);
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** Compass name (16-point) for the bearing from `from` to `to`. */
export function bearingCompass(from: LngLat, to: LngLat): string {
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const index = Math.round(bearingDeg / 22.5) % 16;
  return COMPASS[Math.floor(index / 2)];
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
