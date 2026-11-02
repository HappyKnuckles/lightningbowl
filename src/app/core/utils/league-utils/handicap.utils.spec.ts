import { League } from 'src/app/core/models/league.model';
import { makeGame } from 'src/testing/fixtures';

import { calculateHandicaps, handicapFromAverage, normalizeHandicap } from './handicap.utils';

const at = (iso: string) => new Date(`${iso}T20:00:00`).getTime();
const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

describe('handicap utils', () => {
  it('gives (basis − average) × percentage, rounded down, between 0 and the max', () => {
    expect(handicapFromAverage({ basis: 220, percentage: 90 }, 187.9)).toBe(29); // (220 − 187) × 0.9 = 29.7
    expect(handicapFromAverage({ basis: 200, percentage: 80 }, 150)).toBe(40);
    expect(handicapFromAverage({ basis: 200, percentage: 100 }, 230)).toBe(0);
    expect(handicapFromAverage({ basis: 220, percentage: 100, max: 50 }, 120)).toBe(50);
  });

  describe('calculateHandicaps', () => {
    const thursday: League = { name: 'Thursday', type: 'league', seasons: [], createdAt: 0, handicap: { basis: 220, percentage: 90 } };
    const leagues = (...list: League[]) => new Map(list.map((league) => [league.name, league]));

    it("uses the average before each game's day, so games of one night share a handicap", () => {
      const games = [
        makeGame({ gameId: 'w1g1', league: 'Thursday', date: at('2026-09-03'), totalScore: 180 }),
        makeGame({ gameId: 'w1g2', league: 'Thursday', date: at('2026-09-03') + 900000, totalScore: 200 }),
        makeGame({ gameId: 'w2g1', league: 'Thursday', date: at('2026-09-10'), totalScore: 150 }),
        makeGame({ gameId: 'w2g2', league: 'Thursday', date: at('2026-09-10') + 900000, totalScore: 230 }),
        makeGame({ gameId: 'w3g1', league: 'Thursday', date: at('2026-09-17'), totalScore: 190 }),
      ];

      const handicaps = calculateHandicaps(games, leagues(thursday));

      expect(handicaps.has('w1g1')).toBe(false); // no average and no starting average yet
      expect(handicaps.get('w2g1')).toBe(27); // avg 190 → 30 × 0.9
      expect(handicaps.get('w2g2')).toBe(27);
      expect(handicaps.get('w3g1')).toBe(27); // avg 190 again
    });

    it('starts from the starting average and begins again each season', () => {
      const league: League = {
        ...thursday,
        handicap: { basis: 220, percentage: 90, startingAverage: 170 },
        seasons: [
          { id: 'a', name: '2025/26', start: day('2025-09-04') },
          { id: 'b', name: '2026/27', start: day('2026-09-03') },
        ],
      };
      const games = [
        makeGame({ gameId: 'old', league: 'Thursday', date: at('2026-05-07'), totalScore: 220 }),
        makeGame({ gameId: 'new', league: 'Thursday', date: at('2026-09-03'), totalScore: 160 }),
      ];

      const handicaps = calculateHandicaps(games, leagues(league));

      expect(handicaps.get('old')).toBe(45); // (220 − 170) × 0.9
      expect(handicaps.get('new')).toBe(45); // new season: back to the starting average
    });

    it('leaves games of scratch events and practice alone', () => {
      const scratch: League = { name: 'Sunday', type: 'league', seasons: [], createdAt: 0 };
      const games = [makeGame({ gameId: 's', league: 'Sunday' }), makeGame({ gameId: 'p' })];

      expect(calculateHandicaps(games, leagues(thursday, scratch)).size).toBe(0);
    });
  });

  it('only keeps a rule with a basis and a percentage', () => {
    expect(normalizeHandicap({ basis: 220, percentage: 120, max: 60, startingAverage: -1 })).toEqual({ basis: 220, percentage: 100, max: 60 });
    expect(normalizeHandicap({ basis: 220 })).toBeUndefined();
    expect(normalizeHandicap('220')).toBeUndefined();
  });
});
