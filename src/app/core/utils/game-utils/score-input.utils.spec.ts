import { Frame } from 'src/app/core/models/game.model';

import { formatThrowDisplay, parseBowlingScores, parseInputValue, ScoreSheetPlayerNotFoundError } from './score-input.utils';

/** Frame built from raw throw values, throwIndex assigned 1-based like the app does. */
function frame(values: number[], frameIndex = 1): Frame {
  return { frameIndex, throws: values.map((value, i) => ({ value, throwIndex: i + 1 })) };
}

/** Ten frames with `values` placed in `frameIndex`. */
function framesWith(frameIndex: number, values: number[]): Frame[] {
  const frames: Frame[] = Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
  frames[frameIndex] = frame(values, frameIndex + 1);
  return frames;
}

describe('score-input.utils', () => {
  describe('parseInputValue', () => {
    const frames = framesWith(0, []);

    it('reads a strike from X in either case', () => {
      expect(parseInputValue('X', 0, 0, frames)).toBe(10);
      expect(parseInputValue('x', 0, 0, frames)).toBe(10);
    });

    it('reads a miss from the dash', () => {
      expect(parseInputValue('-', 0, 0, frames)).toBe(0);
    });

    it('completes a spare against the first throw', () => {
      expect(parseInputValue('/', 0, 1, framesWith(0, [7]))).toBe(3);
    });

    it('completes a bonus spare against the second throw in the 10th', () => {
      expect(parseInputValue('/', 9, 2, framesWith(9, [10, 4]))).toBe(6);
    });

    it('completes against the first throw for the 10th bonus after a non-strike opener', () => {
      expect(parseInputValue('/', 9, 2, framesWith(9, [7, 3]))).toBe(3);
    });

    it('treats a spare on the first throw as zero', () => {
      expect(parseInputValue('/', 0, 0, frames)).toBe(0);
    });

    it('parses plain numbers and falls back to zero', () => {
      expect(parseInputValue('7', 0, 0, frames)).toBe(7);
      expect(parseInputValue('nonsense', 0, 0, frames)).toBe(0);
    });
  });

  describe('formatThrowDisplay', () => {
    it('renders an empty string when there is nothing to show', () => {
      expect(formatThrowDisplay(undefined, 0, false)).toBe('');
      expect(formatThrowDisplay(frame([7]), 1, false)).toBe('');
    });

    it('renders a strike on the first throw', () => {
      expect(formatThrowDisplay(frame([10]), 0, false)).toBe('X');
    });

    it('renders a miss as the dash symbol', () => {
      expect(formatThrowDisplay(frame([0, 7]), 0, false)).toBe('–');
      expect(formatThrowDisplay(frame([7, 0]), 1, false)).toBe('–');
    });

    it('renders a spare in frames 1-9', () => {
      expect(formatThrowDisplay(frame([7, 3]), 1, false)).toBe('/');
      expect(formatThrowDisplay(frame([7, 2]), 1, false)).toBe('2');
    });

    it('renders a spare or strike on the second throw of the 10th', () => {
      expect(formatThrowDisplay(frame([7, 3], 10), 1, true)).toBe('/');
      expect(formatThrowDisplay(frame([10, 10], 10), 1, true)).toBe('X');
      expect(formatThrowDisplay(frame([10, 4], 10), 1, true)).toBe('4');
    });

    it('renders the bonus throw after a double strike', () => {
      expect(formatThrowDisplay(frame([10, 10, 10], 10), 2, true)).toBe('X');
      expect(formatThrowDisplay(frame([10, 10, 4], 10), 2, true)).toBe('4');
    });

    it('renders a spare on the bonus throw after a strike and an open second throw', () => {
      expect(formatThrowDisplay(frame([10, 4, 6], 10), 2, true)).toBe('/');
      expect(formatThrowDisplay(frame([10, 4, 5], 10), 2, true)).toBe('5');
    });

    it('renders the bonus throw after a spare', () => {
      expect(formatThrowDisplay(frame([7, 3, 10], 10), 2, true)).toBe('X');
      expect(formatThrowDisplay(frame([7, 3, 5], 10), 2, true)).toBe('5');
    });
  });

  describe('parseBowlingScores', () => {
    it('parses a perfect game from a single throw line', () => {
      const sheet = ['Nico', 'XXXXXXXXXXXX', '30 60 90 120 150 180 210 240 270 300'].join('\n');

      const result = parseBowlingScores(sheet, 'Nico');

      expect(result.frames).toHaveLength(10);
      expect(result.frames[9]).toEqual([10, 10, 10]);
      expect(result.totalScore).toBe(300);
    });

    it('joins throws split across two lines and resolves spares against the previous throw', () => {
      const sheet = ['Nico', 'X7/', '9-XXX', '20 40 60 80 100 120 140 160 180 200'].join('\n');

      const result = parseBowlingScores(sheet, 'Nico');

      expect(result.frames).toEqual([[10], [7, 3], [9, 0], [10], [10], [10]]);
      expect(result.totalScore).toBe(200);
    });

    it('matches the username case-insensitively and ignores lines before it', () => {
      const sheet = [
        'Someone else',
        '55555555555555555555',
        '10 20 30 40 50 60 70 80 90 100',
        'NICO',
        'XXXXXXXXXXXX',
        '30 60 90 120 150 180 210 240 270 300',
      ].join('\n');

      expect(parseBowlingScores(sheet, 'nico').totalScore).toBe(300);
    });

    it('stops at the next player on the sheet', () => {
      const sheet = [
        'Nico',
        'XXXXXXXXXXXX',
        '30 60 90 120 150 180 210 240 270 300',
        'Other player',
        '55555555555555555555',
        '10 20 30 40 50 60 70 80 90 100',
      ].join('\n');

      const result = parseBowlingScores(sheet, 'Nico');

      expect(result.totalScore).toBe(300);
      expect(result.frames[0]).toEqual([10]);
    });

    it('sorts frame scores and keeps only the first ten', () => {
      const sheet = ['Nico', 'XXXXXXXXXXXX', '60 30 120 90', '180 150 240 210', '300 270 330 360'].join('\n');

      const result = parseBowlingScores(sheet, 'Nico');

      expect(result.frameScores).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
      expect(result.totalScore).toBe(300);
    });

    it('throws when the player has no score lines', () => {
      const sheet = ['Nico', 'XXXXXXXXXXXX'].join('\n');

      expect(() => parseBowlingScores(sheet, 'Nico')).toThrow(ScoreSheetPlayerNotFoundError);
    });

    it('throws when the player is not on the sheet at all', () => {
      const sheet = ['Someone else', 'XXXXXXXXXXXX', '30 60 90 120 150 180 210 240 270 300'].join('\n');

      expect(() => parseBowlingScores(sheet, 'Nico')).toThrow(/Insufficient score data for user Nico/);
    });
  });
});
