import { LaneCorrespondence } from 'src/app/core/models/ar.model';
import { LANE_ARROWS } from '../pattern-utils/board.utils';
import { add, confidenceFrom, cross, dot, laneToWorld, length, normalise, scale, solveLaneTransform, subtract, vec } from './pose.utils';
import { feetToMetres, laneXToMetres } from '../pattern-utils/board.utils';

const UP = vec(0, 1, 0);

/** Places the lane in the world at a known heading and origin, then samples arrows. */
function syntheticCorrespondences(headingRad: number, origin = vec(3, 0, -7), noise = 0): LaneCorrespondence[] {
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);

  return [LANE_ARROWS[0], LANE_ARROWS[3], LANE_ARROWS[6]].map((arrow, index) => {
    const across = laneXToMetres(arrow.x);
    const downlane = feetToMetres(arrow.distanceFt);

    // Rotate about the up axis, then translate.
    const world = vec(origin.x + across * cos + downlane * sin, origin.y, origin.z - across * sin + downlane * cos);
    const jitter = noise === 0 ? vec(0, 0, 0) : vec(noise * (index % 2 === 0 ? 1 : -1), 0, noise * (index === 1 ? 1 : -1));

    return { lane: { x: arrow.x, distanceFt: arrow.distanceFt }, world: add(world, jitter) };
  });
}

describe('pose utils', () => {
  describe('vector helpers', () => {
    it('produces an orthonormal right-handed basis', () => {
      const a = normalise(vec(1, 0, 0));
      const b = normalise(vec(0, 1, 0));

      expect(dot(a, b)).toBeCloseTo(0, 10);
      expect(length(cross(a, b))).toBeCloseTo(1, 10);
    });

    it('subtracts and scales', () => {
      expect(subtract(vec(3, 2, 1), vec(1, 1, 1))).toEqual(vec(2, 1, 0));
      expect(scale(vec(1, 2, 3), 2)).toEqual(vec(2, 4, 6));
    });
  });

  describe('solveLaneTransform', () => {
    it('recovers a known lane pose exactly from clean points', () => {
      const heading = 0.4;
      const origin = vec(3, 0, -7);
      const result = solveLaneTransform(syntheticCorrespondences(heading, origin), UP);

      expect(result.anchor).not.toBeNull();
      expect(result.residual).toBeCloseTo(0, 6);

      // The lane origin is the foul line centre, which is lane (0, 0, 0).
      const solvedOrigin = laneToWorld(result.anchor!.matrix, vec(0, 0, 0));
      expect(solvedOrigin.x).toBeCloseTo(origin.x, 5);
      expect(solvedOrigin.z).toBeCloseTo(origin.z, 5);
    });

    it('places the tapped arrows back where they were measured', () => {
      const correspondences = syntheticCorrespondences(-1.1);
      const result = solveLaneTransform(correspondences, UP);

      for (const correspondence of correspondences) {
        const solved = laneToWorld(result.anchor!.matrix, vec(laneXToMetres(correspondence.lane.x), 0, feetToMetres(correspondence.lane.distanceFt)));

        expect(solved.x).toBeCloseTo(correspondence.world.x, 5);
        expect(solved.z).toBeCloseTo(correspondence.world.z, 5);
      }
    });

    it('keeps the lane frame orthonormal', () => {
      const matrix = solveLaneTransform(syntheticCorrespondences(2.3), UP).anchor!.matrix;
      const across = vec(matrix[0], matrix[1], matrix[2]);
      const downlane = vec(matrix[8], matrix[9], matrix[10]);

      expect(length(across)).toBeCloseTo(1, 6);
      expect(length(downlane)).toBeCloseTo(1, 6);
      expect(dot(across, downlane)).toBeCloseTo(0, 6);
    });

    it('keeps the lane flat on the plane', () => {
      const matrix = solveLaneTransform(syntheticCorrespondences(0.9), UP).anchor!.matrix;
      const downlane = vec(matrix[8], matrix[9], matrix[10]);

      expect(dot(downlane, UP)).toBeCloseTo(0, 6);
    });

    it('reports a residual and lower confidence for noisy taps', () => {
      const clean = solveLaneTransform(syntheticCorrespondences(0.4), UP);
      const noisy = solveLaneTransform(syntheticCorrespondences(0.4, vec(3, 0, -7), 0.06), UP);

      expect(noisy.residual).toBeGreaterThan(clean.residual);
      expect(noisy.anchor!.confidence).toBeLessThan(clean.anchor!.confidence);
    });

    it('refuses fewer than two points', () => {
      const result = solveLaneTransform([], UP);

      expect(result.anchor).toBeNull();
      expect(result.reason).toContain('at least two');
    });

    it('refuses coincident points', () => {
      const same: LaneCorrespondence = { lane: { x: 19, distanceFt: 15.5 }, world: vec(1, 0, 1) };
      const result = solveLaneTransform([same, { ...same }], UP);

      expect(result.anchor).toBeNull();
      expect(result.reason).toContain('coincident');
    });

    it('refuses a degenerate plane normal', () => {
      const result = solveLaneTransform(syntheticCorrespondences(0), vec(0, 0, 0));

      expect(result.anchor).toBeNull();
      expect(result.reason).toContain('degenerate');
    });
  });

  describe('confidenceFrom', () => {
    it('caps two-point solves, which always fit perfectly', () => {
      expect(confidenceFrom(0, 2)).toBeLessThanOrEqual(0.5);
      expect(confidenceFrom(0, 3)).toBe(1);
    });

    it('falls to zero for a hopeless fit', () => {
      expect(confidenceFrom(0.5, 3)).toBe(0);
    });
  });
});
