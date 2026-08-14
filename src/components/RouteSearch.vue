<script setup lang="ts">
import { ref } from 'vue';
import { useGeocode } from '../composables/useGeocode';
import type { LngLat, RouteParams } from '../types/route';

const emit = defineEmits<{
  generate: [params: Omit<RouteParams, 'searchQuery' | 'options' | 'selectedOption'> & { referencePoint: LngLat }];
}>();

defineProps<{ busy: boolean }>();

const { error: geocodeError, geocodeQuery, geolocate } = useGeocode();

const query = ref('');
const useGeolocation = ref(false);
const referencePoint = ref<LngLat | null>(null);
const startMode = ref<RouteParams['startMode']>('radius');
const radiusKm = ref(2);
const routeType = ref<RouteParams['routeType']>('loop');
const profile = ref<RouteParams['profile']>('footing');
const distance = ref<'3K' | '5K' | '10K' | 'custom'>('5K');
const customKm = ref(10);

const RADIUS_PRESETS = [2, 3, 5];
const DISTANCE_PRESETS: { label: string; km: number }[] = [
  { label: '3K', km: 3 },
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
];

function targetDistanceKm(): number {
  return distance.value === 'custom' ? customKm.value : DISTANCE_PRESETS.find((d) => d.label === distance.value)!.km;
}

async function useMyLocation() {
  try {
    const point = await geolocate();
    referencePoint.value = point;
    useGeolocation.value = true;
    query.value = '';
  } catch {
    // error surfaced via geocodeError
  }
}

async function onSearch() {
  if (!query.value.trim()) return;
  try {
    referencePoint.value = await geocodeQuery(query.value.trim());
    useGeolocation.value = false;
  } catch {
    // error surfaced via geocodeError
  }
}

function onSubmit() {
  if (!referencePoint.value) {
    geocodeError.value = 'Search for a location or use your GPS position first';
    return;
  }
  emit('generate', {
    referencePoint: referencePoint.value,
    useGeolocation: useGeolocation.value,
    startMode: startMode.value,
    radiusKm: radiusKm.value,
    routeType: routeType.value,
    profile: profile.value,
    targetDistanceKm: targetDistanceKm(),
  });
}
</script>

<template>
  <div class="route-search">
    <h2>🏃 Route Generator</h2>

    <div class="search-row">
      <input
        v-model="query"
        class="search-input"
        type="text"
        placeholder="Search location..."
        @keyup.enter="onSearch"
      />
      <button class="geo-btn" title="Use my location" @click="useMyLocation">📍</button>
    </div>

    <p v-if="referencePoint" class="hint">
      {{ useGeolocation ? 'Using GPS position' : `Found: ${query}` }} — {{ referencePoint[1].toFixed(4) }}, {{ referencePoint[0].toFixed(4) }}
    </p>
    <p v-if="geocodeError" class="error">{{ geocodeError }}</p>

    <fieldset>
      <legend>Start mode</legend>
      <label class="radio">
        <input v-model="startMode" type="radio" value="direct" />
        Direct (start at point)
      </label>
      <label class="radio">
        <input v-model="startMode" type="radio" value="radius" />
        Radius (anchor scatter)
      </label>
    </fieldset>

    <fieldset v-if="startMode === 'radius'">
      <legend>Radius</legend>
      <div class="btn-group">
        <button
          v-for="r in RADIUS_PRESETS"
          :key="r"
          class="chip"
          :class="{ active: radiusKm === r }"
          @click="radiusKm = r"
        >
          {{ r }}km
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend>Route</legend>
      <div class="btn-group">
        <button class="chip" :class="{ active: routeType === 'loop' }" @click="routeType = 'loop'">Loop</button>
        <button class="chip" :class="{ active: routeType === 'linear' }" @click="routeType = 'linear'">Linear</button>
      </div>
      <div class="btn-group profile">
        <button class="chip" :class="{ active: profile === 'footing' }" @click="profile = 'footing'">🏃 Run</button>
        <button class="chip" :class="{ active: profile === 'cycling' }" @click="profile = 'cycling'">🚴 Bike</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>Distance</legend>
      <div class="btn-group">
        <button
          v-for="d in DISTANCE_PRESETS"
          :key="d.label"
          class="chip"
          :class="{ active: distance === d.label }"
          @click="distance = d.label as typeof distance"
        >
          {{ d.label }}
        </button>
        <button class="chip" :class="{ active: distance === 'custom' }" @click="distance = 'custom'">Custom</button>
      </div>
      <input
        v-if="distance === 'custom'"
        v-model.number="customKm"
        class="search-input custom-km"
        type="number"
        min="1"
        max="100"
        placeholder="km"
      />
    </fieldset>

    <button class="generate-btn" :disabled="busy" @click="onSubmit">
      {{ busy ? 'Generating...' : 'Generate Routes' }}
    </button>
  </div>
</template>

<style scoped>
.route-search {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h2 {
  margin: 0;
}

.search-row {
  display: flex;
  gap: 6px;
}

.search-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font: inherit;
  font-size: 15px;
  background: var(--bg);
  color: var(--text-h);
}

.geo-btn {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--code-bg);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 10px;
}

fieldset {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
  padding: 8px 0 0;
}

legend {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text);
  padding: 0;
}

.radio {
  display: block;
  font-size: 14px;
  margin: 4px 0;
  color: var(--text-h);
}

.btn-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-group.profile {
  margin-top: 8px;
}

.chip {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.chip.active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.custom-km {
  margin-top: 8px;
  max-width: 120px;
}

.generate-btn {
  margin-top: 4px;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.hint {
  font-size: 13px;
  color: var(--text);
}

.error {
  font-size: 13px;
  color: #e74c3c;
  margin: 0;
}
</style>
