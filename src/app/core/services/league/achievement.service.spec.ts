import { Game } from 'src/app/core/models/game.model';
import { AchievementService } from './achievement.service';

function game(partial: Partial<Game>): Game {
  return {
    gameId: 'g',
    date: 0,
    frames: [],
    totalScore: 0,
    frameScores: [],
    isClean: false,
    isPerfect: false,
    isPractice: false,
    isPinMode: false,
    patterns: [],
    ...partial,
  };
}

const ONE_DAY = 86_400_000;

describe('AchievementService', () => {
  let service: AchievementService;

  beforeEach(() => {
    service = new AchievementService();
  });

  it('returns nothing for an empty history', () => {
    expect(service.deriveAchievements([])).toEqual([]);
  });

  it('detects the first 200, clean game, perfect game and high game', () => {
    const games = [
      game({ gameId: 'a', date: 1 * ONE_DAY, totalScore: 150 }),
      game({ gameId: 'b', date: 2 * ONE_DAY, totalScore: 210, isClean: true }),
      game({ gameId: 'c', date: 3 * ONE_DAY, totalScore: 300, isPerfect: true, isClean: true }),
    ];

    const result = service.deriveAchievements(games);
    const byType = (t: string) => result.find((a) => a.type === t);

    expect(byType('first200')?.gameId).toBe('b');
    expect(byType('first200')?.value).toBe(210);
    expect(byType('firstCleanGame')?.gameId).toBe('b');
    expect(byType('perfectGame')?.value).toBe(300);
    expect(byType('honorScore')?.value).toBe(300);
    expect(byType('highGame')?.value).toBe(300);
  });

  it('detects first 600 / 700 series and high series from per-night totals', () => {
    const games = [
      // Night 1: 180 + 190 + 240 = 610 (first 600)
      game({ gameId: 'a', date: 1 * ONE_DAY, totalScore: 180 }),
      game({ gameId: 'b', date: 1 * ONE_DAY, totalScore: 190 }),
      game({ gameId: 'c', date: 1 * ONE_DAY, totalScore: 240 }),
      // Night 2: 240 + 240 + 240 = 720 (first 700, high series)
      game({ gameId: 'd', date: 2 * ONE_DAY, totalScore: 240 }),
      game({ gameId: 'e', date: 2 * ONE_DAY, totalScore: 240 }),
      game({ gameId: 'f', date: 2 * ONE_DAY, totalScore: 240 }),
    ];

    const result = service.deriveAchievements(games);
    const byType = (t: string) => result.find((a) => a.type === t);

    expect(byType('first600Series')?.value).toBe(610);
    expect(byType('first700Series')?.value).toBe(720);
    expect(byType('highSeries')?.value).toBe(720);
  });
});
