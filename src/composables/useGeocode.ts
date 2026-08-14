import { ref } from 'vue';
import { config, geocoding } from '@maptiler/sdk';
import type { LngLat } from '../types/route';

export function useGeocode() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  /** Search query → coordinates. Throws on failure. */
  async function geocodeQuery(query: string): Promise<LngLat> {
    loading.value = true;
    error.value = null;
    try {
      if (!config.apiKey) config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;
      const result = await geocoding.forward(query, { limit: 1 });
      const center = result.features[0]?.center as LngLat | undefined;
      if (!center) {
        error.value = 'Location not found';
        throw new Error('Location not found');
      }
      return center;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Geocoding failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Browser geolocation → coordinates. Throws on failure. */
  async function geolocate(): Promise<LngLat> {
    loading.value = true;
    error.value = null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('Geolocation not supported by this browser'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      return [position.coords.longitude, position.coords.latitude];
    } catch (e) {
      const msg =
        e instanceof GeolocationPositionError
          ? e.code === GeolocationPositionError.PERMISSION_DENIED
            ? 'Location permission denied'
            : 'Could not get GPS position'
          : e instanceof Error
            ? e.message
            : 'Could not get GPS position';
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, geocodeQuery, geolocate };
}
