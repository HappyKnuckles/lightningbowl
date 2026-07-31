// pose.utils.ts
//
// Solving the lane pose from tapped or detected points.
//
// The AR runtime already gives us a gravity-aligned plane, which fixes pitch,
// roll and height. That leaves three unknowns — position in the plane and
// heading — so this is a 2D rigid fit, not a full 6-DoF PnP. Far better
// conditioned, and it degrades gracefully with noisy input.

import { LaneCorrespondence, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';
import { feetToMetres, laneXToMetres } from '../pattern-utils/board.utils';

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function scale(a: Vec3, factor: number): Vec3 {
  return vec(a.x * factor, a.y * factor, a.z * factor);
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalise(a: Vec3): Vec3 {
  const magnitude = length(a);
  return magnitude > 0 ? scale(a, 1 / magnitude) : vec(0, 0, 0);
}

/** Any unit vector perpendicular to `up`, chosen to stay numerically stable. */
function perpendicularTo(up: Vec3): Vec3 {
  const seed = Math.abs(up.y) < 0.9 ? vec(0, 1, 0) : vec(1, 0, 0);
  return normalise(cross(seed, up));
}

/** Lane coordinates in metres: across from the centreline, and downlane. */
function laneToMetres(correspondence: LaneCorrespondence): { across: number; downlane: number } {
  return {
    across: laneXToMetres(correspondence.lane.x),
    downlane: feetToMetres(correspondence.lane.distanceFt),
  };
}

export interface LaneSolveResult {
  anchor: LaneAnchor | null;
  /** RMS distance in metres between the measured points and the fitted lane. */
  residual: number;
  reason?: string;
}

/**
 * Fits the lane frame to measured world points.
 *
 * Needs at least two correspondences, and they must not be coincident. Three
 * non-collinear points — the arrows at boards 5, 20 and 35 — are what the
 * calibration flow actually supplies; the extra point is what lets the residual
 * mean anything, since two points always fit perfectly.
 */
export function solveLaneTransform(correspondences: LaneCorrespondence[], up: Vec3): LaneSolveResult {
  if (correspondences.length < 2) {
    return { anchor: null, residual: Infinity, reason: 'Need at least two points to solve the lane pose.' };
  }

  const upAxis = normalise(up);
  if (length(upAxis) === 0) {
    return { anchor: null, residual: Infinity, reason: 'Plane normal is degenerate.' };
  }

  // Plane basis, ordered so that (e1, up, e2) is right-handed.
  const e1 = perpendicularTo(upAxis);
  const e2 = normalise(cross(e1, upAxis));
  const origin = correspondences[0].world;

  const targets = correspondences.map((correspondence) => {
    const relative = subtract(correspondence.world, origin);
    return { u: dot(relative, e1), v: dot(relative, e2) };
  });
  const sources = correspondences.map(laneToMetres);

  const mean = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0) / items.length;
  const sourceCentre = { across: mean(sources, (s) => s.across), downlane: mean(sources, (s) => s.downlane) };
  const targetCentre = { u: mean(targets, (t) => t.u), v: mean(targets, (t) => t.v) };

  // Optimal 2D rotation (Kabsch, scale locked to 1 — the lane is a known size,
  // so letting scale float would just absorb tap error into a wrong lane width).
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < correspondences.length; i++) {
    const sx = sources[i].across - sourceCentre.across;
    const sy = sources[i].downlane - sourceCentre.downlane;
    const tx = targets[i].u - targetCentre.u;
    const ty = targets[i].v - targetCentre.v;
    numerator += sx * ty - sy * tx;
    denominator += sx * tx + sy * ty;
  }

  if (numerator === 0 && denominator === 0) {
    return { anchor: null, residual: Infinity, reason: 'Points are coincident; cannot recover heading.' };
  }

  const theta = Math.atan2(numerator, denominator);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const translation = {
    u: targetCentre.u - (cos * sourceCentre.across - sin * sourceCentre.downlane),
    v: targetCentre.v - (sin * sourceCentre.across + cos * sourceCentre.downlane),
  };

  let squaredError = 0;
  for (let i = 0; i < correspondences.length; i++) {
    const u = cos * sources[i].across - sin * sources[i].downlane + translation.u;
    const v = sin * sources[i].across + cos * sources[i].downlane + translation.v;
    squaredError += (u - targets[i].u) ** 2 + (v - targets[i].v) ** 2;
  }
  const residual = Math.sqrt(squaredError / correspondences.length);

  const across = add(scale(e1, cos), scale(e2, sin));
  const downlane = add(scale(e1, -sin), scale(e2, cos));
  const laneOrigin = add(origin, add(scale(e1, translation.u), scale(e2, translation.v)));

  return {
    anchor: {
      matrix: toMatrix(across, upAxis, downlane, laneOrigin),
      confidence: confidenceFrom(residual, correspondences.length),
      source: 'manual',
    },
    residual,
  };
}

/** Column-major 4x4 from the lane basis and origin. */
export function toMatrix(across: Vec3, up: Vec3, downlane: Vec3, origin: Vec3): Float32Array {
  return new Float32Array([
    across.x,
    across.y,
    across.z,
    0,
    up.x,
    up.y,
    up.z,
    0,
    downlane.x,
    downlane.y,
    downlane.z,
    0,
    origin.x,
    origin.y,
    origin.z,
    1,
  ]);
}

/**
 * Maps fit residual to a 0..1 confidence.
 *
 * 2 cm of RMS error is about as good as tapping on a phone gets; past ~15 cm
 * the pose is not worth anchoring to. Two points always fit perfectly, so their
 * residual carries no information and confidence is capped accordingly.
 */
export function confidenceFrom(residual: number, pointCount: number): number {
  if (!Number.isFinite(residual)) {
    return 0;
  }

  const fit = Math.max(0, Math.min(1, 1 - (residual - 0.02) / 0.13));
  return pointCount < 3 ? Math.min(fit, 0.5) : fit;
}

/** Transforms a point from lane space into world space. */
export function laneToWorld(matrix: Float32Array, lane: Vec3): Vec3 {
  return vec(
    matrix[0] * lane.x + matrix[4] * lane.y + matrix[8] * lane.z + matrix[12],
    matrix[1] * lane.x + matrix[5] * lane.y + matrix[9] * lane.z + matrix[13],
    matrix[2] * lane.x + matrix[6] * lane.y + matrix[10] * lane.z + matrix[14],
  );
}
