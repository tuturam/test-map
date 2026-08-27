import { geocoding } from '@maptiler/sdk'
import type { LngLat } from '../types/route'

export interface GeocodeResult {
  center: LngLat
  label: string
}

export async function geocodeForward(query: string): Promise<GeocodeResult> {
  const result = await geocoding.forward(query, { limit: 1 })
  const feature = result.features?.[0]
  if (!feature?.center) {
    throw new Error('LOCATION_NOT_FOUND')
  }
  return {
    center: [feature.center[0], feature.center[1]],
    label: feature.place_name ?? query,
  }
}

export function getCurrentPosition(): Promise<LngLat> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('GEOLOCATION_UNAVAILABLE'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve([position.coords.longitude, position.coords.latitude]),
      () => reject(new Error('GEOLOCATION_DENIED')),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}
