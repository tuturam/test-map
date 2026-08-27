<script setup lang="ts">
import { config, MapStyle, Map, geocoding } from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css'
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { RouteOption } from '../types/route'
import { computeBounds } from '../utils/math'

const props = defineProps<{ route: RouteOption | null }>()

const mapContainer = shallowRef<HTMLElement | null>(null)
const map = shallowRef<Map | null>(null)

const ROUTE_COLOR = '#e4572e'
const ROUTE_CASE = '#241f1a'

onMounted(async () => {
  config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY

  if (!mapContainer.value) {
    console.error('Map container is not defined')
    return
  }
  const geocodeResult = await geocoding.forward('batam', { limit: 1 })
  const center = geocodeResult.features?.[0]?.center as [number, number] | undefined

  map.value = new Map({
    container: mapContainer.value,
    style: MapStyle.STREETS.DARK,
    center: center || [0, 0],
    zoom: 10,
    geolocate: true,
  })

  renderRoute(props.route)
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

watch(
  () => props.route,
  (route) => {
    renderRoute(route)
  }
)

function renderRoute(route: RouteOption | null) {
  const m = map.value
  if (!m) return

  removeRoute(m)
  if (!route) return

  m.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: route.geojson,
      properties: {},
    },
  })
  m.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ROUTE_COLOR,
      'line-width': 4,
      'line-opacity': 0.95,
    },
  })
  const startCoord = route.geojson.coordinates[0] as [number, number]
  m.addSource('route-start-point', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: startCoord },
      properties: {},
    },
  })
  m.addLayer({
    id: 'route-start',
    type: 'circle',
    source: 'route-start-point',
    paint: {
      'circle-radius': 7,
      'circle-color': ROUTE_COLOR,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': ROUTE_CASE,
    },
  })

  const isLinear = route.waypoints.length === 1
  if (isLinear) {
    const endCoord = route.geojson.coordinates[
      route.geojson.coordinates.length - 1
    ] as [number, number]
    m.addSource('route-end-point', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: endCoord },
        properties: {},
      },
    })
    m.addLayer({
      id: 'route-end',
      type: 'circle',
      source: 'route-end-point',
      paint: {
        'circle-radius': 6,
        'circle-color': ROUTE_CASE,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': ROUTE_COLOR,
      },
    })
  }

  const coords = route.geojson.coordinates as [number, number][]
  if (coords.length < 2) return
  const bounds = computeBounds(coords)
  m.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: 80, maxZoom: 15, duration: 600 }
  )
}

function removeRoute(m: Map) {
  if (!m.getSource('route')) return
  for (const id of ['route-start', 'route-line', 'route-end']) {
    if (m.getLayer(id)) m.removeLayer(id)
  }
  m.removeSource('route')
  if (m.getSource('route-start-point')) m.removeSource('route-start-point')
  if (m.getSource('route-end-point')) m.removeSource('route-end-point')
}
</script>

<template>
  <div class="map-wrap">
    <div class="map" ref="mapContainer"></div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
