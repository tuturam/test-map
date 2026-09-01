export type LngLat = [number, number]
export type ElevCoord = [number, number, number]

export interface LineString {
  type: 'LineString'
  coordinates: (LngLat | ElevCoord)[]
}

export type StartMode = 'direct' | 'radius'
export type RouteType = 'loop' | 'linear'
export type RouteProfile = 'footing' | 'cycling'

export interface RouteOption {
  id: string
  direction: string
  distanceKm: number
  elevationGain: number | null
  elevationLoss: number | null
  estimatedTimeMin: number
  geojson: LineString
  waypoints: LngLat[]
  hasElevation: boolean
}

export interface GeneratePayload {
  searchQuery: string
  useGeolocation: boolean
  startMode: StartMode
  radiusKm: number
  routeType: RouteType
  profile: RouteProfile
  targetDistanceKm: number
  resolvedCoords: string | null
  resolvedLabel: string | null
}
