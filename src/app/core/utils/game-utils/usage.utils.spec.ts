import { Game } from 'src/app/core/models/game.model';

import { countBallUsage, countPatternUsage, rankByUsage, UsageStats } from './usage.utils';

describe('usage.utils', () => {
  const game = (date: number, balls?: string[], patterns?: string[]): Game => ({ date, balls, patterns }) as Game;

  describe('countBallUsage', () => {
    it('counts how often each ball key appears across games', () => {
      const games = [game(1, ['Hammer15', 'Spare10']), game(2, ['Hammer15']), game(3, ['Hammer15', 'Spare10'])];

      const usage = countBallUsage(games);

      expect(usage.get('Hammer15')?.count).toBe(3);
      expect(usage.get('Spare10')?.count).toBe(2);
    });

    it('tracks the most recent usage date per ball', () => {
      const usage = countBallUsage([game(5, ['Hammer15']), game(9, ['Hammer15']), game(7, ['Hammer15'])]);

      expect(usage.get('Hammer15')?.lastUsed).toBe(9);
    });

    it('ignores games without balls', () => {
      const usage = countBallUsage([game(1), game(2, undefined, ['Shark'])]);

      expect(usage.size).toBe(0);
    });
  });

  describe('countPatternUsage', () => {
    it('counts pattern titles and tracks the latest date', () => {
      const usage = countPatternUsage([game(1, undefined, ['Shark', 'Cheetah']), game(4, undefined, ['Shark'])]);

      expect(usage.get('Shark')).toEqual({ count: 2, lastUsed: 4 });
      expect(usage.get('Cheetah')).toEqual({ count: 1, lastUsed: 1 });
    });

    it('ignores games without patterns', () => {
      const usage = countPatternUsage([game(1, ['Hammer15'])]);

      expect(usage.size).toBe(0);
    });
  });

  describe('rankByUsage', () => {
    const usageMap = (entries: Record<string, UsageStats>): Map<string, UsageStats> => new Map(Object.entries(entries));

    it('sorts most used items first', () => {
      const usage = usageMap({ rare: { count: 1, lastUsed: 1 }, favorite: { count: 5, lastUsed: 1 } });

      const result = rankByUsage(['rare', 'favorite', 'unused'], usage, (item) => item);

      expect(result).toEqual(['favorite', 'rare', 'unused']);
    });

    it('breaks count ties by most recently used', () => {
      const usage = usageMap({ old: { count: 2, lastUsed: 10 }, recent: { count: 2, lastUsed: 20 } });

      const result = rankByUsage(['old', 'recent'], usage, (item) => item);

      expect(result).toEqual(['recent', 'old']);
    });

    it('keeps the relative order of unused items', () => {
      const result = rankByUsage(['a', 'b', 'c'], new Map(), (item) => item);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('ranks by the derived key, not the item itself', () => {
      const usage = usageMap({ Hammer15: { count: 2, lastUsed: 1 } });
      const balls = [
        { ball_name: 'Spare', core_weight: '10' },
        { ball_name: 'Hammer', core_weight: '15' },
      ];

      const result = rankByUsage(balls, usage, (ball) => ball.ball_name + ball.core_weight);

      expect(result.map((b) => b.ball_name)).toEqual(['Hammer', 'Spare']);
    });

    it('does not mutate the input array', () => {
      const items = ['a', 'b'];
      rankByUsage(items, usageMap({ b: { count: 1, lastUsed: 1 } }), (item) => item);

      expect(items).toEqual(['a', 'b']);
    });
  });
});
