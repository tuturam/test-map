<script setup lang="ts">
import type { RouteOption } from '../types/route'

defineProps<{
  options: RouteOption[]
  selectedId: string | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()

function chartPoints(option: RouteOption): string {
  const coords = option.geojson.coordinates as [number, number, number][]
  if (!option.hasElevation || coords.length < 2) return ''
  const alts = coords.map((c) => c[2])
  const min = Math.min(...alts)
  const max = Math.max(...alts)
  const span = max - min || 1
  return alts
    .map((alt, i) => `${(i / (alts.length - 1)) * 100},${28 - ((alt - min) / span) * 28}`)
    .join(' ')
}
</script>

<template>
  <section class="options" aria-label="Route options">
    <header class="options__head">
      <h2 class="options__title">Routes</h2>
      <p class="options__count">
        {{ loading ? 'working…' : options.length ? `${options.length} options` : '' }}
      </p>
    </header>

    <div class="options__body">
      <div v-if="loading" class="options__list" aria-busy="true">
        <div v-for="i in 3" :key="i" class="skeleton options__skeleton"></div>
      </div>

      <p v-else-if="error" class="options__error" role="alert">
        {{ error }}
      </p>

      <div v-else-if="options.length" class="options__list">
        <button
          v-for="(option, i) in options"
          :key="option.id"
          type="button"
          class="route-card"
          :class="{ 'is-selected': option.id === selectedId }"
          :aria-pressed="option.id === selectedId"
          @click="emit('select', option.id)"
        >
          <span class="route-card__top">
            <span class="route-card__direction">{{ option.direction }}</span>
            <span class="route-card__tag">Route {{ i + 1 }}</span>
          </span>
          <span class="route-card__stats">
            <span class="route-card__dist">{{ option.distanceKm.toFixed(1) }} km</span>
            <span class="route-card__time">{{ option.estimatedTimeMin }} min</span>
          </span>
          <span class="route-card__elev">
            <template v-if="option.hasElevation">
              <span class="route-card__gain">↑ {{ option.elevationGain }} m</span>
              <span class="route-card__loss">↓ {{ option.elevationLoss }} m</span>
            </template>
            <span v-else class="route-card__na">Elevation n/a</span>
          </span>
          <svg
            v-if="option.hasElevation"
            class="route-card__chart"
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              :points="chartPoints(option)"
              fill="none"
              stroke="var(--color-accent)"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <svg
            v-else
            class="route-card__chart"
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1="14"
              x2="100"
              y2="14"
              stroke="var(--color-rule-2)"
              stroke-width="1"
              stroke-dasharray="3 3"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </button>
      </div>

      <p v-else class="options__empty">
        No routes yet.
        <span class="options__empty-sub">Pick a location, then generate three options.</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.options__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-rule);
}

.options__title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.options__count {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-neutral);
}

.options__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.options__list {
  display: grid;
  gap: var(--space-xs);
  padding: var(--space-sm);
}

.options__skeleton {
  height: 96px;
}

.route-card {
  display: grid;
  gap: var(--space-2xs);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background-color var(--dur-short) var(--ease-out),
    border-color var(--dur-short) var(--ease-out),
    transform 100ms var(--ease-out);
}

.route-card:hover {
  background: var(--color-paper-2);
}

.route-card:active {
  transform: translateY(1px);
}

.route-card.is-selected {
  border-color: var(--color-accent);
  background: var(--color-paper-2);
}

.route-card__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
}

.route-card__direction {
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-ink);
}

.route-card__tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--color-neutral);
}

.route-card__stats {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.route-card__dist {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}

.route-card__time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-neutral);
  font-variant-numeric: tabular-nums;
}

.route-card__elev {
  display: flex;
  gap: var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.route-card__gain {
  color: var(--color-success);
}

.route-card__loss {
  color: var(--color-neutral);
}

.route-card__na {
  color: var(--color-muted);
}

.route-card__chart {
  width: 100%;
  height: 28px;
  margin-top: var(--space-2xs);
}

.options__error {
  margin: 0;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  color: var(--color-error);
}

.options__empty {
  margin: 0;
  padding: var(--space-lg) var(--space-md);
  font-size: var(--text-sm);
  color: var(--color-muted);
  display: grid;
  gap: var(--space-2xs);
}

.options__empty-sub {
  font-size: var(--text-xs);
  color: var(--color-neutral);
}
</style>
