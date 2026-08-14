<script setup lang="ts">
import type { RouteOption } from '../types/route';

defineProps<{
  options: RouteOption[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const COLORS = ['#2ecc71', '#3498db', '#e67e22'];
</script>

<template>
  <div v-if="options.length" class="route-options">
    <h2>Choose Route</h2>
    <button
      v-for="(option, i) in options"
      :key="option.id"
      class="option"
      :class="{ selected: option.id === selectedId }"
      @click="emit('select', option.id)"
    >
      <span class="dot" :style="{ background: COLORS[i % COLORS.length] }"></span>
      <span class="opt-main">
        <span class="opt-title">
          Option {{ i + 1 }} — {{ option.direction }}
          <span v-if="option.id === selectedId" class="star">★</span>
        </span>
        <span class="opt-stats">
          {{ option.distanceKm.toFixed(1) }} km ·
          {{ option.elevationGain }}m↑ {{ option.elevationLoss }}m↓ ·
          {{ option.estimatedTime }} min
        </span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.route-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-h);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.option.selected {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.opt-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.opt-title {
  font-weight: 600;
}

.star {
  color: var(--accent);
}

.opt-stats {
  font-size: 13px;
  color: var(--text);
}
</style>
