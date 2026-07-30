# Route Recommendation Engine — Design Spec

## 1. Overview & Goal

Generate running/cycling route recommendations based on a reference location. User inputs a location → system generates multiple route options (loop or linear) with varying distances → user selects one → rendered on map with elevation info.

### Parameters

1. **Start point** — GPS geolocation or search geocode
2. **Start mode** — direct (route starts at point) or random radius (anchors scattered around)
3. **Route type** — loop (start→waypoints→start) or linear (start→end)
4. **Distance** — target distance: 3K, 5K, 10K, or custom

### Output

3 route options with stats: distance, elevation gain, elevation loss, estimated time.

### Tech Stack

| Concern | Provider |
|---------|----------|
| Geocoding | `@maptiler/sdk` `geocoding.forward()` |
| Routing | OSRM public API (free, GeoJSON) |
| Elevation | `@maptiler/sdk` `elevation.fromLineString()` |
| Map | `@maptiler/sdk` `Map` + GeoJSON source/layer |
| Framework | Vue 3 + TypeScript + Vite |

---

## 2. Architecture & Modules

```
App.vue (orchestrator)
├── RouteSearch.vue       → input form: search, mode, distance, route type
├── RouteOptions.vue      → list 3 route options, user selects one
└── Map.vue               → render selected route as GeoJSON layer

Composables:
├── useGeocode.ts         → search query / geolocation → coordinates
└── useRouteGenerator.ts  → waypoint gen + OSRM call + elevation → RouteOption[]

Utils:
├── math.ts               → haversine, destinationPoint, generateWaypoints
├── osrm.ts               → fetch OSRM, parse GeoJSON response
└── elevation.ts          → thin wrapper around SDK elevation API

Types:
└── route.ts              → RouteParams, RouteOption, Waypoint
```

### File list

```
src/
├── composables/
│   ├── useGeocode.ts
│   └── useRouteGenerator.ts
├── utils/
│   ├── math.ts
│   ├── osrm.ts
│   └── elevation.ts
├── components/
│   ├── Map.vue               # (modified)
│   ├── RouteSearch.vue       # (new)
│   └── RouteOptions.vue      # (new)
├── types/
│   └── route.ts
├── App.vue                   # (modified)
└── main.ts                   # (unchanged)
```

---

## 3. Math & Logic

### 3.1 Haversine — distance between two points

```
Δlat = lat₂ - lat₁
Δlng = lng₂ - lng₁

a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlng/2)
c = 2 · atan2(√a, √(1−a))
d = R · c          ; R = 6371 km (earth radius)
```

```typescript
function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 3.2 Destination Point — point at bearing + distance

From point A, bearing θ°, distance d km → new coordinate B.

```
lat₂ = asin(sin(φ₁)·cos(d/R) + cos(φ₁)·sin(d/R)·cos(θ))
lng₂ = lng₁ + atan2(sin(θ)·sin(d/R)·cos(φ₁), cos(d/R) − sin(φ₁)·sin(φ₂))

φ₁, φ₂ in radians, θ in radians, d in km, R = 6371 km
```

```typescript
function destinationPoint(
  [lng, lat]: [number, number],
  bearingDeg: number,   // 0=north, 90=east, 180=south, 270=west
  distanceKm: number
): [number, number] {
  const R = 6371;
  const dR = distanceKm / R;
  const θ = bearingDeg * Math.PI / 180;
  const φ₁ = lat * Math.PI / 180;
  const lng₁ = lng * Math.PI / 180;

  const φ₂ = Math.asin(
    Math.sin(φ₁) * Math.cos(dR) +
    Math.cos(φ₁) * Math.sin(dR) * Math.cos(θ)
  );
  const lng₂ = lng₁ + Math.atan2(
    Math.sin(θ) * Math.sin(dR) * Math.cos(φ₁),
    Math.cos(dR) - Math.sin(φ₁) * Math.sin(φ₂)
  );

  return [lng₂ * 180 / Math.PI, φ₂ * 180 / Math.PI];
}
```

### 3.3 Waypoint Generation

**Loop mode** — 3 waypoints evenly spread around center:

```typescript
function generateWaypointsForLoop(
  center: [number, number],
  radiusKm: number,
  count: number = 3
): [number, number][] {
  const waypoints: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    // Evenly spaced angles (120° apart) + ±30° jitter
    const baseAngle = (360 / count) * i;
    const jitter = (Math.random() - 0.5) * 60;
    const angle = (baseAngle + jitter + 360) % 360;

    // Random distance 60%-100% of radius
    const distance = radiusKm * (0.6 + Math.random() * 0.4);

    waypoints.push(destinationPoint(center, angle, distance));
  }

  return waypoints;
}
```

**Linear mode** — 1 waypoint at target distance:

```typescript
function generateWaypointForLinear(
  center: [number, number],
  targetDistanceKm: number
): [number, number] {
  const randomBearing = Math.random() * 360;
  return destinationPoint(center, randomBearing, targetDistanceKm);
}
```

### 3.4 OSRM Routing

**Linear:** `GET /route/v1/footing/{A.lng},{A.lat};{B.lng},{B.lat}?geometries=geojson&overview=full`

**Loop:** `GET /route/v1/footing/{A.lng},{A.lat};{B.lng},{B.lat};{C.lng},{C.lat};{A.lng},{A.lat}?geometries=geojson&overview=full`

A appears again at end → closes loop.

OSRM profiles: `footing` (pedestrian, runner), `cycling` (bike).

### 3.5 Elevation

After obtaining GeoJSON from OSRM:

```typescript
const withElevation = await elevation.fromLineString(osrmResult.routes[0].geometry, {
  computeOn: 'server'
});
// withElevation.coordinates → [[lng, lat, alt], [lng, lat, alt], ...]
```

### 3.6 Elevation Statistics

```typescript
function computeElevationStats(coords: [number, number, number][]) {
  let gain = 0, loss = 0;
  for (let i = 1; i < coords.length; i++) {
    const diff = coords[i][2] - coords[i - 1][2];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}
```

### 3.7 Complete Flow

```
INPUT: "Batam", mode=radius, type=loop, distance=5K
────────────────────────────────────────────────────

1. geocoding.forward("Batam") → A [104.04, 1.13]

2. radius = 5 / 2 = 2.5km

3. generateWaypointsForLoop(A, 2.5km, 3)
   → [B: north 2.3km, C: east 2.1km, D: west 2.4km]

4. OSRM footing: A→B→C→D→A
   → GeoJSON LineString (actual road distance: ~4.7km)

5. elevation.fromLineString(geoJSON)
   → coordinates updated with elevation at each point

6. compute stats: gain 80m, loss 80m, distance 4.7km

7. Return 3 options (3 different bearing combinations)
```

---

## 4. API Usage & Error Handling

### 4.1 OSRM Endpoint

```
Base: https://router.project-osrm.org
GET /route/v1/{profile}/{coordinates}?parameters
```

| Parameter | Value |
|-----------|-------|
| `profile` | `footing` (runner), `cycling` |
| `coordinates` | `lng,lat;lng,lat;...` |
| `geometries` | `geojson` |
| `overview` | `full` |
| `steps` | `false` |
| `alternatives` | `false` |

Public server — no key needed.

### 4.2 Fallback: OpenRouteService

```
Base: https://api.openrouteservice.org/v2
GET /directions/{profile}?api_key={key}&start=lng,lat&end=lng,lat
```

Profiles: `foot-walking`, `cycling-regular`. Needs free API key.

### 4.3 Error Handling

```
1. Geocode
   ├── fail → manual coordinate input
   └── no results → "Location not found"

2. Waypoint generation
   └── always works (client-side math, cannot fail)

3. OSRM routing
   ├── timeout (>5s) → retry 1x, then fallback to ORS
   ├── 404 → "No route available in this area"
   └── network error → "Cannot connect to routing server"

4. Elevation
   ├── succeed → add elevation to result
   └── fail → show route WITHOUT elevation, notify: "Elevation data unavailable"

5. Map render
   └── always works (valid GeoJSON = renders)
```

### 4.4 Fallback Chain

```
OSRM (primary)
  ├── OK → return result
  └── FAIL → ORS (secondary, with API key)
               ├── OK → return result
               └── FAIL → user error: "Cannot generate route. Try another location."
```

### 4.5 API Keys & Config

```typescript
// .env
VITE_MAPTILER_API_KEY=xxx       // existing
VITE_ORS_API_KEY=xxx             // optional fallback

// config
export const routingConfig = {
  primary: 'osrm',
  osrmBaseUrl: 'https://router.project-osrm.org',
  orsBaseUrl: 'https://api.openrouteservice.org/v2',
  timeout: 5000,
  retries: 1,
  maxWaypoints: 5,
};
```

### 4.6 State & Types

```typescript
type RouteParams = {
  searchQuery: string;
  useGeolocation: boolean;
  referencePoint: [number, number];

  startMode: 'direct' | 'radius';
  radiusKm: number;

  routeType: 'loop' | 'linear';
  profile: 'footing' | 'cycling';
  targetDistanceKm: number;

  options: RouteOption[];
  selectedOption: string | null;
};

type RouteOption = {
  id: string;
  direction: string;                // "north", "northeast"
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  estimatedTime: number;
  geojson: GeoJSON.LineString;
  waypoints: [number, number][];
};
```

---

## 5. Component Design

### RouteSearch.vue (new)

Input form with all route parameters. Layout:

```
┌─────────────────────────────────────────┐
│  🏃 Route Generator                     │
│                                         │
│  ┌─────────────────────────────┐ 📍    │
│  │ Search location...          │       │
│  └─────────────────────────────┘       │
│                                         │
│  Start Mode:  ○ Direct  ● Radius       │
│  ───────────────────────────────        │
│  Radius:  [2km] [3km] [5km]            │
│  ───────────────────────────────        │
│  Route:   ● Loop  ○ Linear             │
│  Distance: [3K] [5K] [10K] custom       │
│                                         │
│  [Generate Routes]                      │
└─────────────────────────────────────────┘
```

### RouteOptions.vue (new)

Displays 3 route options with stats. User selects one.

```
┌─────────────────────────────────────────┐
│  Choose Route                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🟢 Option 1 — North       ★     │    │
│  │    5.2 km  ·  80m↑  ·  25 min  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🔵 Option 2 — East               │    │
│  │    4.8 km  ·  45m↑  ·  22 min  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ 🟠 Option 3 — South              │    │
│  │    6.1 km  ·  120m↑ ·  30 min  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Map.vue (modified)

Existing code + route rendering via GeoJSON source/layer:

```typescript
// Watch selected route → render on map
watch(() => props.selectedRoute, (route) => {
  if (!route) return;
  if (map.value?.getSource('route')) {
    map.value.removeLayer('route-line');
    map.value.removeSource('route');
  }
  map.value?.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: route.geojson,
      properties: {}
    }
  });
  map.value?.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#e74c3c', 'line-width': 3, 'line-opacity': 0.8 }
  });
  map.value?.fitBounds(computeBounds(route.geojson.coordinates), { padding: 50 });
});
```

---

## 6. Scope & Non-Goals

### In scope (MVP)
- Search by location name → geocode → generate 3 route options
- GPS geolocation as alternative start point
- Loop and linear route types
- Distance presets (3K, 5K, 10K) + custom
- Elevation data display
- Route rendering on MapLibre map

### Out of scope (future)
- User accounts / history
- Real-time GPS tracking
- Turn-by-turn navigation
- Surface type detection (asphalt vs trail)
- Heatmap / popular routes
- Segment challenges
- Mobile app (responsive web only for now)
