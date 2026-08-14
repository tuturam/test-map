import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRoute, RoutingError } from './osrm';

function osrmOk(distance = 5000, duration = 300) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: [
        {
          distance,
          duration,
          geometry: {
            type: 'LineString',
            coordinates: [
              [104.04, 1.13],
              [104.06, 1.14],
            ],
          },
        },
      ],
    }),
  };
}

const COORDS: [number, number][] = [
  [104.04, 1.13],
  [104.06, 1.14],
];

describe('fetchRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns distance, duration and geometry from OSRM', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(osrmOk(5000, 300)));
    const result = await fetchRoute('footing', COORDS);

    expect(result.distanceKm).toBe(5);
    expect(result.durationMin).toBe(5);
    expect(result.geojson.type).toBe('LineString');
    expect(result.geojson.coordinates).toHaveLength(2);
  });

  it('rejects with a user message when OSRM returns NoRoute', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 'NoRoute' }) }),
    );
    await expect(fetchRoute('footing', COORDS)).rejects.toThrow('No route available in this area');
  });

  it('retries once after a network failure, then succeeds', async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(osrmOk());
    vi.stubGlobal('fetch', mock);

    const result = await fetchRoute('footing', COORDS);
    expect(result.distanceKm).toBe(5);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('fails with RoutingError when all providers are unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    vi.stubEnv('VITE_ORS_API_KEY', '');
    await expect(fetchRoute('footing', COORDS)).rejects.toBeInstanceOf(RoutingError);
  });

  it('falls back to ORS when OSRM fails and an API key exists', async () => {
    vi.stubEnv('VITE_ORS_API_KEY', 'test-key');
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              properties: { summary: { distance: 6000, duration: 400 } },
              geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', mock);

    const result = await fetchRoute('footing', COORDS);
    expect(result.distanceKm).toBe(6);
    expect(result.durationMin).toBeCloseTo(6.67, 1);
    // 2 OSRM attempts (initial + 1 retry) then 1 ORS attempt
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('rejects when given fewer than 2 points', async () => {
    await expect(fetchRoute('footing', [[104.04, 1.13]])).rejects.toThrow('Need at least 2 points to route');
  });
});
