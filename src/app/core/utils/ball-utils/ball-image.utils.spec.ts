import { makeBall } from 'src/testing/fixtures';
import { BALL_PLACEHOLDER_IMAGE, ballImageUrl } from './ball-image.utils';

describe('ballImageUrl', () => {
  it('keeps absolute URLs from the ball API', () => {
    expect(ballImageUrl(makeBall({ thumbnail_image: 'https://bowwwl.com/t.png' }))).toBe('https://bowwwl.com/t.png');
  });

  it('resolves relative paths of balls saved before the ball API', () => {
    expect(ballImageUrl(makeBall({ thumbnail_image: '/sites/t.png' }))).toBe('https://bowwwl.com/sites/t.png');
  });

  it('falls back to the ball image when there is no thumbnail', () => {
    expect(ballImageUrl(makeBall({ thumbnail_image: '', ball_image: 'https://bowwwl.com/b.png' }))).toBe('https://bowwwl.com/b.png');
    expect(ballImageUrl(makeBall({ thumbnail_image: null, ball_image: '/b.png' }))).toBe('https://bowwwl.com/b.png');
  });

  it('uses the placeholder when nothing usable is there', () => {
    expect(ballImageUrl(makeBall({ thumbnail_image: null, ball_image: '' }))).toBe(BALL_PLACEHOLDER_IMAGE);
    expect(ballImageUrl(makeBall({ core_image: '' }), 'core')).toBe(BALL_PLACEHOLDER_IMAGE);
    expect(ballImageUrl(undefined)).toBe(BALL_PLACEHOLDER_IMAGE);
  });

  it('prefers the full ball image for the ball kind', () => {
    expect(ballImageUrl(makeBall({ thumbnail_image: '/t.png', ball_image: '/b.png' }), 'ball')).toBe('https://bowwwl.com/b.png');
  });
});
