import type { LineString } from 'geojson';
import type { LngLat } from '../types/route';

export const routingConfig = {
  primary: 'osrm' as const,
  osrmBaseUrl: 'https://router.project-osrm.org',
  orsBaseUrl: 'https://api.openrouteservice.org/v2',
  timeout: 5000,
  retries: 1,
  maxWaypoints: 5,
};

export type RouteProfile = 'footing' | 'cycling';

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  geojson: LineString;
};

export class RoutingError extends Error {
  /**
   * True when the provider gave a definitive answer (e.g. no route exists).
   * Definitive errors are surfaced to the user immediately — no retry or
   * fallback, since another provider cannot change the answer.
   */
  definitive: boolean;

  constructor(message: string, definitive = false) {
    super(message);
    this.definitive = definitive;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RoutingError('Routing request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** `osrm` → `ors` profile mapping; `footing`/`cycling` → ORS API names. */
const ORS_PROFILES: Record<RouteProfile, string> = {
  footing: 'foot-walking',
  cycling: 'cycling-regular',
};

async function fetchOsrm(profile: RouteProfile, coords: LngLat[]): Promise<RouteResult> {
  const positions = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url =
    `${routingConfig.osrmBaseUrl}/route/v1/${profile}/${positions}` +
    '?geometries=geojson&overview=full&steps=false&alternatives=false';

  let res: Response;
  try {
    res = await withTimeout(fetch(url), routingConfig.timeout);
  } catch {
    throw new RoutingError('Cannot connect to routing server');
  }
  if (!res.ok) {
    if (res.status === 404) throw new RoutingError('No route available in this area', true);
    throw new RoutingError(`Routing server error (${res.status})`);
  }
  const data = await res.json();
  if (data.code !== 'Ok') {
    throw new RoutingError(
      data.code === 'NoRoute' ? 'No route available in this area' : `Routing failed: ${data.code}`,
      true,
    );
  }
  const route = data.routes?.[0];
  if (!route?.geometry) throw new RoutingError('Empty route response');
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geojson: route.geometry as LineString,
  };
}

async function fetchOrs(profile: RouteProfile, coords: LngLat[]): Promise<RouteResult> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
  if (!apiKey) throw new RoutingError('No OpenRouteService API key configured');

  const orsProfile = ORS_PROFILES[profile];
  const [start, end] = [coords[0], coords[coords.length - 1]];
  // ORS v2 takes one start/end pair; intermediate waypoints appended as lng,lat
  const body: { coordinates: string[] } = { coordinates: [start.join(','), end.join(',')] };
  if (coords.length > 2) {
    body.coordinates.push(...coords.slice(1, -1).map(([lng, lat]) => `${lng},${lat}`));
  }
  const url = `${routingConfig.orsBaseUrl}/directions/${orsProfile}`;
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
    }),
    routingConfig.timeout,
  );
  if (!res.ok) throw new RoutingError(`OpenRouteService error (${res.status})`);
  const data = await res.json();
  const feature = data.features?.[0];
  const summary = feature?.properties?.summary;
  if (!feature?.geometry || !summary) throw new RoutingError('Empty ORS route response');
  return {
    distanceKm: summary.distance / 1000,
    durationMin: summary.duration / 60,
    geojson: feature.geometry as LineString,
  };
}

/**
 * Route through `coords`. OSRM primary (with retry), ORS fallback.
 * Throws RoutingError with a user-facing message when all providers fail.
 */
export async function fetchRoute(profile: RouteProfile, coords: LngLat[]): Promise<RouteResult> {
  if (coords.length < 2) throw new RoutingError('Need at least 2 points to route');

  let lastError: unknown;
  for (let attempt = 0; attempt <= routingConfig.retries; attempt++) {
    try {
      return await fetchOsrm(profile, coords);
    } catch (e) {
      // Definitive answer (e.g. NoRoute): another provider cannot help.
      if (e instanceof RoutingError && e.definitive) throw e;
      lastError = e;
    }
  }
  try {
    return await fetchOrs(profile, coords);
  } catch (e) {
    // Prefer the primary provider's message (e.g. "Cannot connect to routing
    // server") over secondary issues like a missing ORS API key.
    if (e instanceof RoutingError && e.definitive) throw e;
    throw lastError instanceof Error ? lastError : new RoutingError('Cannot connect to routing server');
  }
}
