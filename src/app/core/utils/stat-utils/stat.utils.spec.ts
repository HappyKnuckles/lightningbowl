import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { environment } from 'src/environments/environment';
import { buildHighlights, pickTop, pickTopFromList } from './stat.utils';

function highlight(overrides: Partial<HighlightItemStats> = {}): HighlightItemStats {
  return { name: 'Item', image: '', avg: 0, highestGame: 0, lowestGame: 0, gameCount: 0, cleanGameCount: 0, strikeRate: 0, ...overrides };
}

/** Highest `avg` wins, the comparator shape both pick helpers expect. */
const byAvgDesc = (a: HighlightItemStats, b: HighlightItemStats) => b.avg - a.avg;

describe('stat.utils', () => {
  describe('pickTopFromList', () => {
    it('returns the item the comparator ranks first', () => {
      const items = [highlight({ name: 'Low', avg: 150 }), highlight({ name: 'High', avg: 210 })];

      expect(pickTopFromList(items, byAvgDesc).name).toBe('High');
    });

    it('keeps the first item when the comparator ties', () => {
      const items = [highlight({ name: 'First', avg: 180 }), highlight({ name: 'Second', avg: 180 })];

      expect(pickTopFromList(items, byAvgDesc).name).toBe('First');
    });

    it('falls back to an empty highlight for an empty list', () => {
      expect(pickTopFromList([], byAvgDesc)).toEqual({
        name: '',
        image: '',
        avg: 0,
        highestGame: 0,
        lowestGame: 0,
        gameCount: 0,
        cleanGameCount: 0,
        strikeRate: 0,
      });
    });
  });

  describe('pickTop', () => {
    it('picks over the values of a keyed record', () => {
      const stats = { hammer: highlight({ name: 'Hammer', avg: 190 }), spare: highlight({ name: 'Spare', avg: 170 }) };

      expect(pickTop(stats, byAvgDesc).name).toBe('Hammer');
    });

    it('falls back to an empty highlight for an empty record', () => {
      expect(pickTop({}, byAvgDesc).name).toBe('');
    });
  });

  describe('buildHighlights', () => {
    const src = {
      mostPlayedBall: highlight({ name: 'Most played ball' }),
      bestBall: highlight({ name: 'Best ball' }),
      allBalls: [highlight({ name: 'Ball' })],
      mostPlayedPattern: highlight({ name: 'Most played pattern' }),
      bestPattern: highlight({ name: 'Best pattern' }),
      allPatterns: [highlight({ name: 'Pattern' })],
    };

    it('builds the four highlight cards in ball-then-pattern order', () => {
      const highlights = buildHighlights(src);

      expect(highlights.map((h) => h.title)).toEqual(['Most used ball', 'Best ball', 'Most played pattern', 'Best pattern']);
      expect(highlights.map((h) => h.item.name)).toEqual(['Most played ball', 'Best ball', 'Most played pattern', 'Best pattern']);
    });

    it('sorts usage cards by game count and quality cards by average', () => {
      expect(buildHighlights(src).map((h) => h.sortMode)).toEqual(['gameCount', 'avg', 'gameCount', 'avg']);
    });

    it('renders balls round and without an image base, patterns square off the images url', () => {
      const highlights = buildHighlights(src);

      expect(highlights.slice(0, 2).every((h) => h.roundImage && h.imageUrlBase === undefined)).toBe(true);
      expect(highlights.slice(2).every((h) => !h.roundImage && h.imageUrlBase === environment.imagesUrl)).toBe(true);
    });

    it('carries the matching empty message and full item list per card', () => {
      const highlights = buildHighlights(src);

      expect(highlights[0].emptyMessage).toBe('No Games with balls saved.');
      expect(highlights[2].emptyMessage).toBe('No Games with patterns saved.');
      expect(highlights[1].allItems).toBe(src.allBalls);
      expect(highlights[3].allItems).toBe(src.allPatterns);
    });
  });
});
