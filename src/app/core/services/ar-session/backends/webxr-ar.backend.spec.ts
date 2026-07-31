import { multiplyMatrices } from './webgl-lane.renderer';
import { invertMatrix, transformPoint } from './webxr-ar.backend';

/** Column-major identity. */
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** Column-major perspective projection, matching what WebXR supplies. */
function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
}

/** Column-major translation. */
function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

describe('WebXR matrix helpers', () => {
  describe('multiplyMatrices', () => {
    it('leaves a matrix unchanged against identity', () => {
      const m = translation(3, -2, 7);

      expect(Array.from(multiplyMatrices(IDENTITY, m))).toEqual(Array.from(m));
      expect(Array.from(multiplyMatrices(m, IDENTITY))).toEqual(Array.from(m));
    });

    it('composes translations in column-major order', () => {
      const composed = multiplyMatrices(translation(1, 2, 3), translation(10, 20, 30));

      // The translation column accumulates.
      expect(composed[12]).toBe(11);
      expect(composed[13]).toBe(22);
      expect(composed[14]).toBe(33);
    });

    it('applies the left matrix after the right one', () => {
      // A point at the origin, moved by the right matrix then the left.
      const composed = multiplyMatrices(translation(0, 5, 0), translation(2, 0, 0));
      const point = transformPoint(composed, 0, 0, 0, 1);

      expect(point!.x).toBeCloseTo(2, 6);
      expect(point!.y).toBeCloseTo(5, 6);
    });
  });

  describe('invertMatrix', () => {
    it('inverts identity to identity', () => {
      expect(Array.from(invertMatrix(IDENTITY)!)).toEqual(Array.from(IDENTITY));
    });

    it('round-trips a translation', () => {
      const m = translation(4, -3, 9);
      const composed = multiplyMatrices(m, invertMatrix(m)!);

      for (let i = 0; i < 16; i++) {
        expect(composed[i]).toBeCloseTo(IDENTITY[i], 5);
      }
    });

    it('round-trips a projection matrix', () => {
      const projection = perspective(Math.PI / 3, 1.8, 0.1, 100);
      const composed = multiplyMatrices(projection, invertMatrix(projection)!);

      for (let i = 0; i < 16; i++) {
        expect(composed[i]).toBeCloseTo(IDENTITY[i], 4);
      }
    });

    it('returns null for a singular matrix', () => {
      const singular = new Float32Array(16);

      expect(invertMatrix(singular)).toBeNull();
    });
  });

  describe('transformPoint', () => {
    it('divides through by w', () => {
      const projection = perspective(Math.PI / 2, 1, 0.1, 100);
      // A point 10 m ahead projects to the centre of the screen.
      const point = transformPoint(projection, 0, 0, -10, 1);

      expect(point!.x).toBeCloseTo(0, 6);
      expect(point!.y).toBeCloseTo(0, 6);
    });

    it('returns null when w collapses', () => {
      const projection = perspective(Math.PI / 2, 1, 0.1, 100);

      expect(transformPoint(projection, 0, 0, 0, 0)).toBeNull();
    });
  });

  describe('unprojection round-trip', () => {
    it('recovers the screen direction a point projects to', () => {
      const projection = perspective(Math.PI / 3, 1.5, 0.1, 100);
      const inverse = invertMatrix(projection)!;

      // Take a known point in front of the camera, project it to clip space...
      const target = { x: 1.2, y: -0.4, z: -6 };
      const projected = transformPoint(projection, target.x, target.y, target.z, 1)!;

      // ...then unproject that clip position back along the ray.
      const near = transformPoint(inverse, projected.x, projected.y, -1, 1)!;
      const far = transformPoint(inverse, projected.x, projected.y, 1, 1)!;

      const dx = far.x - near.x;
      const dy = far.y - near.y;
      const dz = far.z - near.z;
      const magnitude = Math.hypot(dx, dy, dz);

      // The recovered ray direction must point at the original target.
      const expected = Math.hypot(target.x, target.y, target.z);
      expect(dx / magnitude).toBeCloseTo(target.x / expected, 4);
      expect(dy / magnitude).toBeCloseTo(target.y / expected, 4);
      expect(dz / magnitude).toBeCloseTo(target.z / expected, 4);
    });
  });
});
