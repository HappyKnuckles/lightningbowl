import { Frame } from 'src/app/core/models/game.model';
import { setThrowBall } from './ball.utils';

function emptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
}

describe('ball.utils', () => {
  describe('setThrowBall', () => {
    it('stores the ball as pendingBall instead of fabricating a throw when none exists yet', () => {
      const frames = emptyFrames();

      setThrowBall(frames, 0, 0, { name: 'Storm IQ Tour', weight: '15' });

      expect(frames[0].throws).toEqual([]);
      expect(frames[0].pendingBall).toEqual({ name: 'Storm IQ Tour', weight: '15' });
    });

    it('sets the ball directly on a throw that already exists', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 6, throwIndex: 1 }];

      setThrowBall(frames, 0, 0, { name: 'Storm IQ Tour', weight: '15' });

      expect(frames[0].throws[0].ball).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(frames[0].pendingBall).toBeUndefined();
    });
  });
});
