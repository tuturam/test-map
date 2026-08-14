import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRoute, fetchTripRoute, RoutingError } from './osrm';

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

function tripOk(distance = 5000, duration = 300) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      waypoints: [
        { waypoint_index: 2 },
        { waypoint_index: 1 },
        { waypoint_index: 0 },
        { waypoint_index: 3 },
      ],
      trips: [
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

describe('fetchTripRoute', () => {
  it('returns trip distance, duration and waypoint order from OSRM', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(tripOk(5000, 300)));
    const { result, waypointOrder } = await fetchTripRoute('footing', COORDS);

    expect(result.distanceKm).toBe(5);
    expect(result.durationMin).toBe(5);
    expect(result.geojson.type).toBe('LineString');
    expect(waypointOrder).toEqual([2, 1, 0, 3]);
  });

  it('requests a closed roundtrip with any start and end', async () => {
    const mock = vi.fn().mockResolvedValue(tripOk());
    vi.stubGlobal('fetch', mock);

    await fetchTripRoute('footing', COORDS);

    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('/trip/v1/footing/');
    expect(url).toContain('roundtrip=true');
    expect(url).toContain('source=any');
    expect(url).toContain('destination=any');
  });

  it('falls back to ordered routing when the trip endpoint fails', async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // trip attempt
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // trip retry
      .mockResolvedValueOnce(osrmOk()); // ordered /route
    vi.stubGlobal('fetch', mock);

    const { result, waypointOrder } = await fetchTripRoute('footing', COORDS);

    expect(result.distanceKm).toBe(5);
    expect(waypointOrder).toBeNull();
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls[2][0] as string).toContain('/route/v1/footing/');
  });
});
