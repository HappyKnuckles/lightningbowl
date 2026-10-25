export type BowlingStyle = 'one-handed' | 'two-handed';

/** Only relevant for one-handers; two-handers don't use a thumb hole. */
export type GripStyle = 'fingertip' | 'semi-fingertip' | 'conventional';

/**
 * The bowler's hand and release measurements; they apply to every ball, unlike a ball's drilling.
 * All lengths in inches. The PAP is written as '<over>" over, <vertical>" up/down',
 * measured from the center of the grip.
 */
export interface BowlerFit {
  /** Unset means one-handed. Two-handers have no thumb hole, so grip and span don't apply. */
  style?: BowlingStyle;
  grip?: GripStyle;
  middleSpan?: number;
  ringSpan?: number;
  papOver?: number;
  /** Positive = up, negative = down. */
  papVertical?: number;
}
