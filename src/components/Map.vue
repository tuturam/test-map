<script setup lang="ts">
import { config, MapStyle, Map, geocoding } from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { GeocodingControl } from '@maptiler/geocoding-control/maptilersdk';
import type { RouteOption } from '../types/route';

const props = defineProps<{ selectedRoute: RouteOption | null }>();

const mapContainer = shallowRef<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);

const ROUTE_SOURCE = 'route';
const ROUTE_LAYER = 'route-line';

function computeBounds(coords: [number, number][]): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

function clearRoute() {
  if (!map.value) return;
  if (map.value.getSource(ROUTE_SOURCE)) {
    map.value.removeLayer(ROUTE_LAYER);
    map.value.removeSource(ROUTE_SOURCE);
  }
}

function renderRoute(route: RouteOption) {
  const m = map.value;
  if (!m) return;
  clearRoute();
  m.addSource(ROUTE_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: route.geojson,
      properties: {},
    },
  });
  m.addLayer({
    id: ROUTE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    paint: { 'line-color': '#e74c3c', 'line-width': 3, 'line-opacity': 0.8 },
  });
  m.fitBounds(computeBounds(route.geojson.coordinates as [number, number][]), { padding: 50 });
}

function applySelectedRoute() {
  if (!props.selectedRoute) {
    clearRoute();
    return;
  }
  // sources/layers need the style; queue until map finished loading
  if (map.value?.isStyleLoaded()) {
    renderRoute(props.selectedRoute);
  } else {
    map.value?.once('load', () => renderRoute(props.selectedRoute!));
  }
}

watch(() => props.selectedRoute, applySelectedRoute);

onMounted(async () => {
  config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

  if (!mapContainer.value) {
    console.error('Map container is not defined');
    return;
  }
  let center: [number, number] | undefined;
  try {
    const geocodeResult = await geocoding.forward('batam');
    center = geocodeResult.features[0]?.center as [number, number] | undefined;
  } catch (e) {
    console.warn('Initial geocode failed, using default center:', e);
  }
  map.value = new Map({
    container: mapContainer.value,
    style: MapStyle.STREETS,
    center: center || [0, 0],
    zoom: 10,
    geolocate: true,
  });

  // geocode control
  const gc = new GeocodingControl({
    enableReverse: 'always',
    adjustUrl(url) {
        // for reverse geocoding use only address type
        if (/\/\d+\.?\d*%2C\d+.?\d*.json$/.test(url.pathname)) {
          url.searchParams.set("types", "address");
          url.searchParams.set("limit", "3");
        }
      },
  })
  map.value.addControl(gc, 'top-left')

  map.value.once('load', () => applySelectedRoute());
});

onUnmounted(() => {
  if (map.value) {
    map.value.remove();
  }
});

</script>

<template>
<div class="map-wrap">
  <div class="map" ref="mapContainer" style="width: 100%; height: 100%;"></div>
</div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%;
  height: calc(100vh - 77px); /* calculate height of the screen minus the heading */
}

.map {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
