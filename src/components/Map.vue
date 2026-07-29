<script setup lang="ts">
import { config, MapStyle, Map, geocoding } from '@maptiler/sdk'
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { onMounted, onUnmounted, shallowRef } from 'vue';

const mapContainer = shallowRef<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);

onMounted( async () => {
  config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

  if (!mapContainer.value) {
    console.error('Map container is not defined');
    return;
  }
  const geocodeResult = await geocoding.forward('batam');
  const center = geocodeResult.features[0]?.center as [number, number] | undefined;
  console.log('Geocode result:', geocodeResult);
  map.value = new Map({
    container: mapContainer.value,
    style: MapStyle.STREETS,
    center: center || [0, 0],
    zoom: 10
  });
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