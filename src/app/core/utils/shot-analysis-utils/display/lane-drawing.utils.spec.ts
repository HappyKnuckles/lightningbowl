import { boardToX, distanceToY, loupeSourceRect } from './lane-drawing.utils';

describe('lane drawing utils', () => {
  describe('lane geometry', () => {
    it('puts board 1 on the right gutter for right-handers and on the left for left-handers', () => {
      expect(boardToX(1, 'right', 390)).toBeCloseTo(385);
      expect(boardToX(1, 'left', 390)).toBeCloseTo(5);
      expect(boardToX(20, 'right', 390)).toBeCloseTo(195);
    });

    it('draws the foul line at the bottom and the head pin near the top', () => {
      expect(distanceToY(0, 640, 64)).toBe(640);
      expect(distanceToY(60, 640, 64)).toBe(40);
    });
  });

  describe('loupeSourceRect', () => {
    it('centres on the point and stays inside the frame', () => {
      expect(loupeSourceRect(500, 500, 2160, 3840, 200)).toEqual({ x: 400, y: 400, size: 200 });
      expect(loupeSourceRect(10, 3830, 2160, 3840, 200)).toEqual({ x: 0, y: 3640, size: 200 });
    });
  });
});
