import type { LineString, LngLat, RouteProfile } from '../types/route'

export interface OsrmResult {
  geojson: LineString
  distanceKm: number
}

const OSRM_BASE = 'https://router.project-osrm.org'
const TIMEOUT_MS = 6000

export class RoutingError extends Error {
  readonly code: 'no-route' | 'timeout' | 'network' | 'server'

  constructor(code: 'no-route' | 'timeout' | 'network' | 'server', message: string) {
    super(message)
    this.code = code
  }
}

export async function osrmRoute(
  profile: RouteProfile,
  coords: LngLat[],
  retries = 1
): Promise<OsrmResult> {
  const path = coords.map((c) => `${c[0]},${c[1]}`).join(';')
  const url = `${OSRM_BASE}/route/v1/${profile}/${path}?geometries=geojson&overview=full&steps=false&alternatives=false`

  let lastError: RoutingError | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url)
      if (!response.ok) {
        throw new RoutingError(
          response.status === 404 ? 'no-route' : 'server',
          `Routing server responded with ${response.status}`
        )
      }
      const data = (await response.json()) as {
        code: string
        routes?: { geometry: LineString; distance: number }[]
      }
      const route = data.routes?.[0]
      if (data.code !== 'Ok' || !route) {
        throw new RoutingError('no-route', 'No route found between the given points')
      }
      return { geojson: route.geometry, distanceKm: route.distance / 1000 }
    } catch (err) {
      lastError =
        err instanceof RoutingError ? err : new RoutingError('network', 'Routing request failed')
    }
  }
  throw lastError ?? new RoutingError('network', 'Routing request failed')
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new RoutingError('timeout', 'Routing server timed out')
    }
    throw new RoutingError('network', 'Cannot reach the routing server')
  } finally {
    clearTimeout(timer)
  }
}
