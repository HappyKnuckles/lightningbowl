import { Ball } from 'src/app/core/models/ball.model';

/** Spec fields that used to be stored as strings (bowwwl.com's format). */
const SPEC_FIELDS = ['core_rg', 'core_diff', 'core_int_diff'] as const;

function toSpec(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A ball's identity in one weight: the API's `key` ("1234-15"), or the same built from `ball_id` and
 * `core_weight` for a ball without one. Treat it as opaque; never parse it.
 */
export function ballKey(ball: Pick<Ball, 'ball_id' | 'core_weight'> & { key?: string }): string {
  return ball.key || `${ball.ball_id}-${ball.core_weight}`;
}

type SpecField = (typeof SPEC_FIELDS)[number];

/**
 * A ball saved on the device before the ball API: bowwwl.com's data, with the
 * specs as strings ("2.50", "n/a") and no `key` or `first_seen_at`.
 */
export type LegacyBall = Omit<Ball, 'key' | 'first_seen_at' | SpecField> &
  Partial<Pick<Ball, 'key' | 'first_seen_at'>> &
  Record<SpecField, string | number | null>;

/** A ball as read from device storage (arsenal, favorites, ball cache). */
export type SavedBall = Ball | LegacyBall;

function isCurrentBall(ball: SavedBall): ball is Ball {
  return !!ball.key && ball.first_seen_at !== undefined && SPEC_FIELDS.every((field) => typeof ball[field] === 'number' || ball[field] === null);
}

/** Whether a saved ball dates from before the ball API (its images still point at bowwwl.com). */
export function savedBeforeBallApi(ball: Ball): boolean {
  return ball.first_seen_at === '';
}

/** Brings a ball saved on the device to the current shape. */
export function toStoredBall(ball: SavedBall): Ball {
  if (isCurrentBall(ball)) return ball;
  return {
    ...ball,
    key: ballKey(ball),
    // unknown for balls saved before the ball API, until they're refreshed from it (see `savedBeforeBallApi`)
    first_seen_at: ball.first_seen_at ?? '',
    core_rg: toSpec(ball.core_rg),
    core_diff: toSpec(ball.core_diff),
    core_int_diff: toSpec(ball.core_int_diff),
  };
}
