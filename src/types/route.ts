import type { LineString } from 'geojson';

export type LngLat = [number, number];

export type RouteParams = {
  searchQuery: string;
  useGeolocation: boolean;
  referencePoint: LngLat;

  startMode: 'direct' | 'radius';
  radiusKm: number;

  routeType: 'loop' | 'linear';
  profile: 'footing' | 'cycling';
  targetDistanceKm: number;

  options: RouteOption[];
  selectedOption: string | null;
};

export type RouteOption = {
  id: string;
  direction: string; // "north", "northeast", ...
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  estimatedTime: number; // minutes
  geojson: LineString;
  waypoints: LngLat[];
};
