import { clampTrimWindow, defaultTrimWindow, MAX_SHOT_WINDOW_S } from './trim.utils';

describe('trim utils', () => {
  describe('trim window', () => {
    it('defaults to the start of the video, capped at the tracker limit', () => {
      expect(defaultTrimWindow(8)).toEqual({ startS: 0, endS: 8 });
      expect(defaultTrimWindow(45)).toEqual({ startS: 0, endS: MAX_SHOT_WINDOW_S });
    });

    it('drags the other knob along when the window would get too long', () => {
      const previous = { startS: 10, endS: 28 };
      expect(clampTrimWindow({ startS: 5, endS: 28 }, previous, 60)).toEqual({ startS: 5, endS: 23 });
      expect(clampTrimWindow({ startS: 10, endS: 40 }, previous, 60)).toEqual({ startS: 22, endS: 40 });
    });

    it('keeps the window inside the video', () => {
      expect(clampTrimWindow({ startS: -1, endS: 12 }, { startS: 0, endS: 5 }, 10)).toEqual({ startS: 0, endS: 10 });
    });
  });
});
