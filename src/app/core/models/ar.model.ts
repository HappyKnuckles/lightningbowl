import { Pattern } from './pattern.model';

/** Where an AR session is in its lifecycle. */
export type ArPhase = 'idle' | 'unsupported' | 'starting' | 'scanning' | 'calibrating' | 'tracking' | 'limited' | 'failed';

/** Which implementation is driving the session. */
export type ArBackendKind = 'native' | 'webxr' | 'fallback' | 'mock';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A point on the lane in lane coordinates: lane-axis unit and feet downlane. */
export interface LanePoint {
  x: number;
  distanceFt: number;
}

/** A tapped or detected screen point paired with the lane point it represents. */
export interface LaneCorrespondence {
  lane: LanePoint;
  world: Vec3;
}

/**
 * The complete output of calibration: one rigid transform from lane space to
 * world space, plus how much we trust it.
 */
export interface LaneAnchor {
  /** Column-major 4x4, ready to hand to a rendering backend. */
  matrix: Float32Array;
  confidence: number;
  source: 'manual' | 'automatic';
}

export interface ArSupport {
  supported: boolean;
  backend: ArBackendKind;
  reason?: string;
}

export interface ArOverlayState {
  pattern: Pattern | null;
  comparePattern: Pattern | null;
  showBoardNumbers: boolean;
  showDistanceRuler: boolean;
}
