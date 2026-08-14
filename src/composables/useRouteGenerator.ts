import { ref } from 'vue';
import type { LngLat, RouteOption } from '../types/route';
import {
  bearingCompass,
  generateWaypointForLinear,
  generateWaypointsForLoop,
  randomId,
} from '../utils/math';
import { fetchRoute, type RouteProfile } from '../utils/osrm';
import { addElevation } from '../utils/elevation';

export type GenerateParams = {
  referencePoint: LngLat;
  startMode: 'direct' | 'radius';
  radiusKm: number;
  routeType: 'loop' | 'linear';
  profile: RouteProfile;
  targetDistanceKm: number;
};

const OPTION_COUNT = 3;

/** Radius of the waypoint scatter for a loop route. */
function loopRadius(p: GenerateParams): number {
  // radius mode: user-chosen radius; direct mode: loop sized to hit the target distance
  return p.startMode === 'radius' ? p.radiusKm : p.targetDistanceKm / 2;
}

/** Waypoints for one option; loop includes the closing point at the end. */
function buildCoordinates(p: GenerateParams): { waypoints: LngLat[]; coordinates: LngLat[] } {
  const { referencePoint: center, routeType } = p;
  if (routeType === 'linear') {
    const waypoint = generateWaypointForLinear(center, p.targetDistanceKm);
    return { waypoints: [waypoint], coordinates: [center, waypoint] };
  }
  const waypoints = generateWaypointsForLoop(center, loopRadius(p));
  return { waypoints, coordinates: [center, ...waypoints, center] };
}

async function generateOneOption(
  p: GenerateParams,
): Promise<{ option: RouteOption; hasElevation: boolean }> {
  const { waypoints, coordinates } = buildCoordinates(p);
  const result = await fetchRoute(p.profile, coordinates);

  const elevation = await addElevation(result.geojson);
  const geojson = elevation
    ? {
        type: 'LineString' as const,
        coordinates: elevation.coordinates,
      }
    : result.geojson;

  return {
    hasElevation: elevation !== null,
    option: {
      id: randomId(),
      direction: bearingCompass(p.referencePoint, waypoints[0]),
      distanceKm: Number(result.distanceKm.toFixed(1)),
      elevationGain: elevation?.gain ?? 0,
      elevationLoss: elevation?.loss ?? 0,
      estimatedTime: Math.round(result.durationMin),
      geojson,
      waypoints,
    },
  };
}

export function useRouteGenerator() {
  const options = ref<RouteOption[]>([]);
  const generating = ref(false);
  const error = ref<string | null>(null);
  /** Set when any option was rendered without elevation data. */
  const elevationUnavailable = ref(false);

  async function generate(p: GenerateParams): Promise<RouteOption[]> {
    generating.value = true;
    error.value = null;
    elevationUnavailable.value = false;
    try {
      // 3 attempts with fresh random scatter per option
      const settled = await Promise.allSettled(
        Array.from({ length: OPTION_COUNT }, () => generateOneOption(p)),
      );
      const ok = settled
        .filter((r): r is PromiseFulfilledResult<{ option: RouteOption; hasElevation: boolean }> => r.status === 'fulfilled')
        .map((r) => r.value);

      const failed = settled.filter((r) => r.status === 'rejected').length;
      if (ok.length === 0) {
        const reason = settled[0] && 'reason' in settled[0] ? settled[0].reason : null;
        error.value =
          reason instanceof Error && reason.message
            ? reason.message
            : 'Cannot generate route. Try another location.';
        return [];
      }
      if (failed > 0) {
        console.warn(`${failed} of ${OPTION_COUNT} route options failed`);
      }
      elevationUnavailable.value = ok.some((r) => !r.hasElevation);
      options.value = ok.map((r) => r.option);
      return options.value;
    } finally {
      generating.value = false;
    }
  }

  return { options, generating, error, elevationUnavailable, generate };
}
