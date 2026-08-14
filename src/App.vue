<script setup lang="ts">
import { ref } from 'vue';
import MapComponent from './components/Map.vue';
import RouteSearch from './components/RouteSearch.vue';
import RouteOptions from './components/RouteOptions.vue';
import { useRouteGenerator } from './composables/useRouteGenerator';
import type { RouteOption } from './types/route';

const { options, generating, error, elevationUnavailable, generate } = useRouteGenerator();
const selectedRoute = ref<RouteOption | null>(null);

type GenerateParams = Parameters<typeof generate>[0];

async function onGenerate(params: GenerateParams) {
  const result = await generate(params);
  selectedRoute.value = result[0] ?? null;
}

function onSelect(id: string) {
  selectedRoute.value = options.value.find((o) => o.id === id) ?? null;
}
</script>

<template>
  <header class="topbar">
    <span class="logo">🗺️ Route Generator</span>
  </header>

  <div class="layout">
    <aside class="sidebar">
      <RouteSearch :busy="generating" @generate="onGenerate" />
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="elevationUnavailable" class="hint">Elevation data unavailable</p>
      <RouteOptions
        :options="options"
        :selected-id="selectedRoute?.id ?? null"
        @select="onSelect"
      />
    </aside>

    <main class="map-panel">
      <MapComponent :selected-route="selectedRoute" />
    </main>
  </div>
</template>

<style scoped>
.topbar {
  height: 77px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-h);
}

.layout {
  display: flex;
  height: calc(100vh - 77px);
}

.sidebar {
  width: 340px;
  flex-shrink: 0;
  padding: 16px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.map-panel {
  flex: 1;
  min-width: 0;
}

.error {
  font-size: 13px;
  color: #e74c3c;
  margin: 0;
}

.hint {
  font-size: 13px;
  color: var(--text);
  margin: 0;
}
</style>
