import { describe, expect, it } from 'vitest';
import {
  bearingCompass,
  destinationPoint,
  generateWaypointForLinear,
  generateWaypointsForLoop,
  haversine,
  randomId,
} from './math';

describe('haversine', () => {
  it('returns ~111.19 km per degree of latitude at the equator', () => {
    expect(haversine([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
  });

  it('returns 0 for identical points', () => {
    expect(haversine([104.04, 1.13], [104.04, 1.13])).toBe(0);
  });

  it('is symmetric', () => {
    const a: [number, number] = [104.04, 1.13];
    const b: [number, number] = [106.85, -6.21];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });
});

describe('destinationPoint', () => {
  it('moves north for bearing 0', () => {
    const [lng, lat] = destinationPoint([0, 0], 0, 111.19);
    expect(lng).toBeCloseTo(0, 3);
    expect(lat).toBeCloseTo(1, 1);
  });

  it('moves east for bearing 90', () => {
    const [lng, lat] = destinationPoint([0, 0], 90, 111.19);
    expect(lng).toBeCloseTo(1, 1);
    expect(lat).toBeCloseTo(0, 3);
  });

  it('round-trips: distance from origin to result equals distanceKm', () => {
    const start: [number, number] = [104.04, 1.13];
    const point = destinationPoint(start, 213, 2.5);
    expect(haversine(start, point)).toBeCloseTo(2.5, 1);
  });
});

describe('generateWaypointsForLoop', () => {
  it('generates `count` waypoints within radiusKm of the center', () => {
    const center: [number, number] = [104.04, 1.13];
    const radiusKm = 2.5;
    const waypoints = generateWaypointsForLoop(center, radiusKm, 3);

    expect(waypoints).toHaveLength(3);
    for (const wp of waypoints) {
      const d = haversine(center, wp);
      // spec 3.3: random distance 60%-100% of radius
      expect(d).toBeGreaterThanOrEqual(radiusKm * 0.6 - 0.01);
      expect(d).toBeLessThanOrEqual(radiusKm);
    }
  });
});

describe('generateWaypointForLinear', () => {
  it('lands at targetDistanceKm from the center', () => {
    const center: [number, number] = [104.04, 1.13];
    const wp = generateWaypointForLinear(center, 5);
    expect(haversine(center, wp)).toBeCloseTo(5, 1);
  });
});

describe('bearingCompass', () => {
  it('reports east for a due-east destination', () => {
    expect(bearingCompass([0, 0], [1, 0])).toBe('east');
  });

  it('reports north for a due-north destination', () => {
    expect(bearingCompass([0, 0], [0, 1])).toBe('north');
  });
});

describe('randomId', () => {
  it('returns unique ids', () => {
    expect(randomId()).not.toBe(randomId());
  });
});
