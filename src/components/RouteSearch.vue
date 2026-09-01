<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GeneratePayload, RouteProfile, RouteType, StartMode } from '../types/route'
import { geocodeForward } from '../composables/useGeocode'

defineProps<{ loading: boolean }>()

const emit = defineEmits<{ generate: [payload: GeneratePayload] }>()

const searchQuery = ref('')
const useGeolocation = ref(false)
const startMode = ref<StartMode>('radius')
const radiusKm = ref(3)
const routeType = ref<RouteType>('loop')
const profile = ref<RouteProfile>('footing')
const distancePreset = ref<'3' | '5' | '10' | 'custom'>('5')
const customKm = ref(5)

const searchError = ref<string | null>(null)
const distanceError = ref<string | null>(null)
const resolvedCoords = ref<string | null>(null)
const resolvedLabel = ref<string | null>(null)
const resolving = ref(false)
const searched = ref(false)
const geolocationError = ref<string | null>(null)

const targetDistanceKm = computed(() =>
  distancePreset.value === 'custom' ? customKm.value : Number(distancePreset.value)
)

watch(
  searchQuery,
  async (newVal) => {
    if (!useGeolocation.value && newVal && newVal.trim() && !resolving.value) {
      const query = newVal.trim()
      if (query.length >= 2) {
        try {
          resolving.value = true
          searchError.value = null
          const result = await geocodeForward(query)
          resolvedCoords.value = `${result.center[0].toFixed(6)}, ${result.center[1].toFixed(6)}`
          resolvedLabel.value = result.label
          searched.value = true
        } catch (err) {
          if (err instanceof Error) {
            switch (err.message) {
              case 'LOCATION_NOT_FOUND':
                searchError.value = 'Location not found. Check the name, or use your position instead.'
                break
              default:
                searchError.value = 'Search error. Try again.'
            }
          } else {
            searchError.value = 'Search error. Try again.'
          }
          resolvedCoords.value = null
          resolvedLabel.value = null
          searched.value = false
        } finally {
          resolving.value = false
        }
      }
    }
  }
)

function toggleGeolocation() {
  useGeolocation.value = !useGeolocation.value
  searchError.value = null
  geolocationError.value = null
  resolvedCoords.value = null
  resolvedLabel.value = null
  searched.value = false

  if (useGeolocation.value) {
    resolving.value = true
    if (!('geolocation' in navigator)) {
      geolocationError.value = 'GPS not available on this device.'
      useGeolocation.value = false
      resolving.value = false
      return
    }
    // Check if we're on a secure context (HTTPS or localhost)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      geolocationError.value = 'GPS requires HTTPS. Run this app over HTTPS or localhost.'
      useGeolocation.value = false
      resolving.value = false
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude.toFixed(6)
        const lat = pos.coords.latitude.toFixed(6)
        resolvedCoords.value = `${lng}, ${lat}`
        resolvedLabel.value = 'My position'
        resolving.value = false
      },
      (err) => {
        resolving.value = false
        if (err.code === err.PERMISSION_DENIED) {
          geolocationError.value = 'GPS permission denied. Search for a location instead.'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          geolocationError.value = 'GPS position unavailable. Search for a location instead.'
        } else {
          geolocationError.value = 'GPS error. Search for a location instead.'
        }
        useGeolocation.value = false
        resolvedCoords.value = null
        resolvedLabel.value = null
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
}

function submit() {
  searchError.value = null
  distanceError.value = null

  if (!useGeolocation.value && !searchQuery.value.trim()) {
    searchError.value = 'Enter a place name, or switch on "Use my position".'
    return
  }

  const target = targetDistanceKm.value
  if (!Number.isFinite(target) || target < 1 || target > 50) {
    distanceError.value = 'Distance must be 1–50 km.'
    return
  }

  emit('generate', {
    searchQuery: searchQuery.value.trim(),
    useGeolocation: useGeolocation.value,
    startMode: startMode.value,
    radiusKm: radiusKm.value,
    routeType: routeType.value,
    profile: profile.value,
    targetDistanceKm: target,
    resolvedCoords: resolvedCoords.value,
    resolvedLabel: resolvedLabel.value,
  })
}
</script>

<template>
  <form class="search" novalidate @submit.prevent="submit">
    <div class="field">
      <label class="field__label" for="search">Location</label>
      <div class="search__row">
        <input
          id="search"
          v-model="searchQuery"
          class="input"
          type="text"
          placeholder="City or place name"
          :disabled="useGeolocation"
          :aria-invalid="searchError ? 'true' : undefined"
          aria-describedby="search-hint"
        />
        <button
          type="button"
          class="btn btn--icon"
          :class="{ 'is-active': useGeolocation }"
          :aria-pressed="useGeolocation"
          :title="useGeolocation ? 'Position on' : 'Use my position'"
          @click="toggleGeolocation"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="3.25" />
            <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" />
          </svg>
        </button>
      </div>
      <p
        id="search-hint"
        class="field__hint"
        :class="{ 'field__hint--error': searchError }"
      >
        {{ searchError ?? (useGeolocation ? 'Using your GPS position.' : 'Name a city, district, or landmark.') }}
      </p>
      <div v-if="geolocationError" class="field__hint field__hint--error" style="margin-top: var(--space-xs);">
        {{ geolocationError }}
      </div>
      <div v-if="resolvedCoords && !resolving" class="resolved-coords">
        <span class="resolved-coords__label">{{ resolvedLabel }}</span>
        <span class="resolved-coords__value">{{ resolvedCoords }}</span>
      </div>
      <div v-if="resolving" class="resolved-coords">
        <span class="spinner" aria-hidden="true"></span>
        <span>Resolving&hellip;</span>
      </div>
    </div>

    <div class="field">
      <legend class="field__label">Start mode</legend>
      <div class="seg">
        <span class="seg__item">
          <input id="sm-direct" v-model="startMode" type="radio" value="direct" />
          <label for="sm-direct">Direct</label>
        </span>
        <span class="seg__item">
          <input id="sm-radius" v-model="startMode" type="radio" value="radius" />
          <label for="sm-radius">Radius</label>
        </span>
      </div>
      <p class="field__hint">
        {{
          startMode === 'radius'
            ? 'Start points scattered around the anchor.'
            : 'Every route starts at the anchor itself.'
        }}
      </p>
    </div>

    <div v-if="startMode === 'radius'" class="field">
      <span class="field__label">Anchor radius</span>
      <div class="chips">
        <span v-for="r in [2, 3, 5]" :key="r" class="chip">
          <input :id="`r-${r}`" v-model="radiusKm" type="radio" :value="r" />
          <label :for="`r-${r}`">{{ r }} km</label>
        </span>
      </div>
    </div>

    <div class="field">
      <legend class="field__label">Route</legend>
      <div class="seg">
        <span class="seg__item">
          <input id="rt-loop" v-model="routeType" type="radio" value="loop" />
          <label for="rt-loop">Loop</label>
        </span>
        <span class="seg__item">
          <input id="rt-linear" v-model="routeType" type="radio" value="linear" />
          <label for="rt-linear">Linear</label>
        </span>
      </div>
      <p class="field__hint">
        {{ routeType === 'loop' ? 'Three points, returns to the start.' : 'Out to a point, no return.' }}
      </p>
    </div>

    <div class="field">
      <legend class="field__label">Mode</legend>
      <div class="seg">
        <span class="seg__item">
          <input id="pr-run" v-model="profile" type="radio" value="footing" />
          <label for="pr-run">Run</label>
        </span>
        <span class="seg__item">
          <input id="pr-ride" v-model="profile" type="radio" value="cycling" />
          <label for="pr-ride">Ride</label>
        </span>
      </div>
    </div>

    <div class="field">
      <span class="field__label">Distance</span>
      <div class="chips">
        <span v-for="d in ['3', '5', '10']" :key="d" class="chip">
          <input :id="`d-${d}`" v-model="distancePreset" type="radio" :value="d" />
          <label :for="`d-${d}`">{{ d }}K</label>
        </span>
        <span class="chip">
          <input id="d-custom" v-model="distancePreset" type="radio" value="custom" />
          <label for="d-custom">Custom</label>
        </span>
      </div>
      <div v-if="distancePreset === 'custom'" class="search__custom">
        <input
          v-model.number="customKm"
          class="input"
          type="number"
          min="1"
          max="50"
          step="0.5"
          aria-label="Custom distance in kilometres"
          :aria-invalid="distanceError ? 'true' : undefined"
        />
        <span class="search__custom-unit">km</span>
      </div>
      <p class="field__hint" :class="{ 'field__hint--error': distanceError }">
        {{ distanceError ?? 'Target length; the routed distance may vary.' }}
      </p>
    </div>

    <button type="submit" class="btn btn--primary search__submit" :disabled="loading">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <span class="btn__label">{{ loading ? 'Generating…' : 'Generate routes' }}</span>
    </button>
  </form>
</template>

<style scoped>
.search {
  display: grid;
}

.search__row {
  display: flex;
  gap: var(--space-xs);
}

.search__custom {
  position: relative;
}

.search__custom .input {
  padding-right: var(--space-2xl);
}

.search__custom-unit {
  position: absolute;
  top: 50%;
  right: var(--space-md);
  transform: translateY(-50%);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-muted);
  pointer-events: none;
}

.search__submit {
  width: 100%;
  margin-top: var(--space-md);
}

.resolved-coords {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-paper-2);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}

.resolved-coords__label {
  color: var(--color-muted);
}

.resolved-coords__value {
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 150ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
