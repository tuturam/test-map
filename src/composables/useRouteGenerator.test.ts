import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/osrm', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/osrm')>();
  return { ...original, fetchRoute: vi.fn(), fetchTripRoute: vi.fn() };
});
vi.mock('../utils/elevation', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/elevation')>();
  return { ...original, addElevation: vi.fn() };
});

import { fetchRoute, fetchTripRoute } from '../utils/osrm';
import { addElevation } from '../utils/elevation';
import { useRouteGenerator } from './useRouteGenerator';

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

const baseParams = {
  referencePoint: [104.04, 1.13] as [number, number],
  startMode: 'radius' as const,
  radiusKm: 2.5,
  routeType: 'loop' as const,
  profile: 'footing' as const,
  targetDistanceKm: 5,
};

const lineGeojson = { type: 'LineString' as const, coordinates: [[104.04, 1.13], [104.06, 1.14]] };

const tripResult = {
  result: { distanceKm: 4.7, durationMin: 25, geojson: lineGeojson },
  waypointOrder: [1, 2, 3, 0],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked(fetchRoute).mockResolvedValue({ distanceKm: 4.7, durationMin: 25, geojson: lineGeojson });
  mocked(fetchTripRoute).mockResolvedValue(tripResult);
  mocked(addElevation).mockResolvedValue({
    coordinates: [[104.04, 1.13, 10], [104.06, 1.14, 20]],
    gain: 10,
    loss: 5,
  });
});

describe('useRouteGenerator', () => {
  it('returns 3 options with distance, elevation and time stats', async () => {
    const { generate, options, error, elevationUnavailable } = useRouteGenerator();
    const result = await generate(baseParams);

    expect(result).toHaveLength(3);
    expect(options.value).toHaveLength(3);
    expect(error.value).toBeNull();
    expect(elevationUnavailable.value).toBe(false);
    expect(fetchTripRoute).toHaveBeenCalledTimes(3);

    for (const opt of result) {
      expect(opt.distanceKm).toBe(4.7);
      expect(opt.elevationGain).toBe(10);
      expect(opt.elevationLoss).toBe(5);
      expect(opt.estimatedTime).toBe(25);
      expect(opt.geojson.type).toBe('LineString');
      expect(opt.direction).toBeTruthy();
      expect(opt.id).toBeTruthy();
    }
  });

  it('passes open waypoint chains to the trip endpoint for loops', async () => {
    const { generate } = useRouteGenerator();
    await generate(baseParams);

    const calls = mocked(fetchTripRoute).mock.calls as [string, [number, number][]][];
    expect(calls).toHaveLength(3);
    for (const [profile, coords] of calls) {
      expect(profile).toBe('footing');
      // center + 3 waypoints; the trip endpoint closes the loop itself
      expect(coords).toHaveLength(4);
      expect(coords[0]).toEqual([104.04, 1.13]);
      expect(coords[coords.length - 1]).not.toEqual([104.04, 1.13]);
    }
  });

  it('keeps ordered routing for linear routes', async () => {
    const { generate } = useRouteGenerator();
    await generate({ ...baseParams, routeType: 'linear' });

    expect(fetchTripRoute).not.toHaveBeenCalled();
    const calls = mocked(fetchRoute).mock.calls as [string, [number, number][]][];
    expect(calls).toHaveLength(3);
    for (const [profile, coords] of calls) {
      expect(profile).toBe('footing');
      expect(coords).toHaveLength(2); // A + 1 waypoint
      expect(coords[0]).toEqual([104.04, 1.13]);
    }
  });

  it('scatters waypoints differently per option', async () => {
    const { generate } = useRouteGenerator();
    await generate(baseParams);

    const calls = mocked(fetchTripRoute).mock.calls as [string, [number, number][]][];
    const chains = calls.map(([, coords]) =>
      coords.slice(1).map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join('|'),
    );
    // 3 independent random draws: no two options share a waypoint set
    expect(new Set(chains).size).toBe(3);
  });

  it('flags elevationUnavailable but still returns routes when elevation fails', async () => {
    mocked(addElevation).mockResolvedValue(null);
    const { generate, elevationUnavailable, options } = useRouteGenerator();
    const result = await generate(baseParams);

    expect(elevationUnavailable.value).toBe(true);
    expect(result).toHaveLength(3);
    expect(options.value[0].elevationGain).toBe(0);
    expect(options.value[0].elevationLoss).toBe(0);
  });

  it('sets a user-facing error when every route attempt fails', async () => {
    mocked(fetchTripRoute).mockRejectedValue(new Error('No route available in this area'));
    const { generate, error, options } = useRouteGenerator();
    const result = await generate(baseParams);

    expect(result).toHaveLength(0);
    expect(options.value).toHaveLength(0);
    expect(error.value).toBe('No route available in this area');
  });

  it('keeps partial results when some options fail', async () => {
    mocked(fetchTripRoute)
      .mockResolvedValueOnce(tripResult)
      .mockRejectedValueOnce(new Error('No route available in this area'))
      .mockResolvedValueOnce({
        result: { distanceKm: 5.1, durationMin: 27, geojson: lineGeojson },
        waypointOrder: [1, 2, 3, 0],
      });
    const { generate, options, error } = useRouteGenerator();
    const result = await generate(baseParams);

    expect(result).toHaveLength(2);
    expect(options.value).toHaveLength(2);
    expect(error.value).toBeNull();
  });
});
