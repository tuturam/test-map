<script setup lang="ts">
import { computed, ref } from 'vue'
import { config } from '@maptiler/sdk'
import MapComponent from './components/Map.vue'
import RouteOptions from './components/RouteOptions.vue'
import RouteSearch from './components/RouteSearch.vue'
import { geocodeForward, getCurrentPosition } from './composables/useGeocode'
import { generateRoutes } from './composables/useRouteGenerator'
import type { GeneratePayload, LngLat, RouteOption } from './types/route'
import { RoutingError } from './utils/osrm'

config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY

const loading = ref(false)
const error = ref<string | null>(null)
const options = ref<RouteOption[]>([])
const selectedId = ref<string | null>(null)
const locationLabel = ref('')

const selectedRoute = computed(
  () => options.value.find((option) => option.id === selectedId.value) ?? null
)

async function handleGenerate(payload: GeneratePayload) {
  loading.value = true
  error.value = null
  options.value = []
  selectedId.value = null

  try {
    const { center, label } = await resolveStartPoint(payload)
    locationLabel.value = label
    options.value = await generateRoutes(payload, center)
  } catch (err) {
    error.value = toErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function resolveStartPoint(payload: GeneratePayload): Promise<{ center: LngLat; label: string }> {
  if (payload.useGeolocation) {
    const center = await getCurrentPosition()
    return { center, label: 'My position' }
  }
  if (payload.searchQuery) {
    const result = await geocodeForward(payload.searchQuery)
    return { center: result.center, label: result.label }
  }
  throw new Error('NO_LOCATION')
}

function toErrorMessage(err: unknown): string {
  if (err instanceof RoutingError) {
    switch (err.code) {
      case 'timeout':
        return 'The routing server timed out. Try again.'
      case 'no-route':
        return 'No route could be generated here. Try another location or a shorter distance.'
      case 'network':
        return 'Cannot reach the routing server. Check your connection.'
      default:
        return 'The routing server failed. Try again.'
    }
  }
  if (err instanceof Error) {
    switch (err.message) {
      case 'NO_LOCATION':
        return 'Enter a location, or switch on “Use my position”.'
      case 'LOCATION_NOT_FOUND':
        return 'Location not found. Check the name, or use your position instead.'
      case 'GEOLOCATION_DENIED':
        return 'Position access was denied. Search for a location instead.'
      case 'GEOLOCATION_UNAVAILABLE':
        return 'Position is unavailable on this device. Search for a location instead.'
    }
  }
  return 'Something went wrong. Try again.'
}
</script>

<template>
  <div class="app">
    <header class="app__bar">
      <h1 class="app__bar-title">Route Gen</h1>
      <p class="app__bar-meta">{{ locationLabel || 'Set a start point' }}</p>
    </header>

    <main class="app__main">
      <MapComponent :route="selectedRoute" />

      <aside class="panel panel--left">
        <header class="panel__head">
          <h2 class="panel__title">Setup</h2>
        </header>
        <div class="panel__body">
          <RouteSearch :loading="loading" @generate="handleGenerate" />
        </div>
      </aside>

      <aside class="panel panel--right">
        <RouteOptions
          :options="options"
          :selected-id="selectedId"
          :loading="loading"
          :error="error"
          @select="selectedId = $event"
        />
      </aside>
    </main>
  </div>
</template>
