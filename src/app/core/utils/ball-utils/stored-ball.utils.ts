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
 * Brings a ball saved on the device (arsenal, favorites, ball cache) to the
 * current shape. Balls saved before the ball API have their specs as strings
 * ("2.50", "n/a"); the API returns numbers or null.
 */
export function toStoredBall(ball: Ball): Ball {
  if (SPEC_FIELDS.every((field) => typeof ball[field] === 'number' || ball[field] === null)) return ball;
  const normalized = { ...ball };
  for (const field of SPEC_FIELDS) normalized[field] = toSpec(ball[field]);
  return normalized;
}

/** A ball as a game stores it: the name, plus the weight when one was recorded. */
export interface StoredBallValue {
  name: string;
  weight?: string;
}

/** Trailing weight in "Name15", "Name 15", "Name 15lbs", "Name 15lb" or "Name 15#". */
const WEIGHT_SUFFIX = /^(.*?\S)\s*(\d{1,2})\s*(?:lbs?|#)?$/i;
const MIN_WEIGHT = 6;
const MAX_WEIGHT = 16;

/**
 * Splits a ball value stored in a game into name and weight. Games store the
 * plain name, or (ball per throw) the name with the weight appended, with or
 * without a space and "lbs". A trailing number only counts as a weight when
 * it's a ball weight (6–16), so names like "Black Widow 3.0" stay intact;
 * callers should still try the value as a plain name first.
 */
export function parseStoredBall(value: string): StoredBallValue {
  const trimmed = value.trim();
  const match = WEIGHT_SUFFIX.exec(trimmed);
  if (match) {
    const weight = Number(match[2]);
    if (weight >= MIN_WEIGHT && weight <= MAX_WEIGHT) return { name: match[1].trim(), weight: String(weight) };
  }
  return { name: trimmed };
}

/** "Name 15lbs", or just the name when no weight was recorded. */
export function formatStoredBall({ name, weight }: StoredBallValue): string {
  return weight ? `${name} ${weight}lbs` : name;
}
