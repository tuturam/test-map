import { describe, expect, it } from 'vitest';
import { computeElevationStats } from './elevation';

type AltCoord = [number, number, number];

describe('computeElevationStats', () => {
  it('sums cumulative gain and loss along the track', () => {
    const coords: AltCoord[] = [
      [0, 0, 10],
      [0, 0, 5],
      [0, 0, 15],
      [0, 0, 15],
      [0, 0, 13],
    ];
    // 10→5: -5 loss | 5→15: +10 gain | 15→15: 0 | 15→13: -2 loss
    expect(computeElevationStats(coords)).toEqual({ gain: 10, loss: 7 });
  });

  it('returns zero for flat track', () => {
    const coords: AltCoord[] = [
      [104.04, 1.13, 5],
      [104.06, 1.14, 5],
      [104.08, 1.13, 5],
    ];
    expect(computeElevationStats(coords)).toEqual({ gain: 0, loss: 0 });
  });

  it('returns zero for empty or single-point input', () => {
    expect(computeElevationStats([])).toEqual({ gain: 0, loss: 0 });
    expect(computeElevationStats([[104.04, 1.13, 5]])).toEqual({ gain: 0, loss: 0 });
  });

  it('rounds fractional values', () => {
    const coords: AltCoord[] = [
      [0, 0, 0.4],
      [0, 0, 1.2],
    ];
    expect(computeElevationStats(coords)).toEqual({ gain: 1, loss: 0 });
  });
});
