import { Handedness } from 'src/app/core/models/shot-analysis.model';

import { BOARD_COUNT } from '../geometry/lane.utils';

/** Approximate arrow positions: board and feet from the foul line. */
export const LANE_ARROWS: readonly [number, number][] = [
  [5, 13],
  [10, 14],
  [15, 15],
  [20, 16],
  [25, 15],
  [30, 14],
  [35, 13],
];

/**
 * Horizontal position of a board on a lane drawn `width` wide, as seen from the approach
 * (the right gutter on the right). Board 1 is the bowler's gutter side.
 */
export function boardToX(board: number, handedness: Handedness, width: number): number {
  const fromGutter = (board - 0.5) / BOARD_COUNT;
  const fromLeft = handedness === 'right' ? 1 - fromGutter : fromGutter;
  return fromLeft * width;
}

/** Vertical position of a distance on a lane drawn `height` tall showing `shownFt` feet (foul line at the bottom). */
export function distanceToY(distanceFt: number, height: number, shownFt: number): number {
  return (1 - distanceFt / shownFt) * height;
}

/** Square region of the frame to magnify around a point, kept inside the frame. */
export function loupeSourceRect(x: number, y: number, frameWidth: number, frameHeight: number, size: number): { size: number; x: number; y: number } {
  const side = Math.min(size, frameWidth, frameHeight);
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  return { x: clamp(x - side / 2, frameWidth - side), y: clamp(y - side / 2, frameHeight - side), size: side };
}
