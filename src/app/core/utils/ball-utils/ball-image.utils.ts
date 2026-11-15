import { BOWWWL_URL } from 'src/app/core/constants/app.constants';
import { Ball } from 'src/app/core/models/ball.model';

/** Shown when a ball has no usable image. */
export const BALL_PLACEHOLDER_IMAGE = 'assets/svg/ball-placeholder.svg';

export type BallImageKind = 'thumbnail' | 'ball' | 'core';

type BallImages = Pick<Ball, 'thumbnail_image' | 'ball_image' | 'core_image'>;

/** Image fields to try, in order, for each kind of image. */
const SOURCES: Record<BallImageKind, (keyof BallImages)[]> = {
  thumbnail: ['thumbnail_image', 'ball_image'],
  ball: ['ball_image', 'thumbnail_image'],
  core: ['core_image'],
};

/**
 * An absolute image URL for a ball. The ball API returns absolute URLs; balls
 * saved before it have bowwwl.com's relative paths (or empty strings). Falls
 * back to the other ball image, then to a placeholder.
 */
export function ballImageUrl(ball: Partial<BallImages> | null | undefined, kind: BallImageKind = 'thumbnail'): string {
  for (const field of SOURCES[kind]) {
    const value = ball?.[field]?.trim();
    if (!value) continue;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return BOWWWL_URL + value;
  }
  return BALL_PLACEHOLDER_IMAGE;
}
