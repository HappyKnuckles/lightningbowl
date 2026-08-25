import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { Game } from 'src/app/core/models/game.model';
import { makeGame } from 'src/testing/fixtures';
import { vi } from 'vitest';

import { HighScoreAlertService, HighScoreRecord } from './high-score-alert.service';

/** Games of one series, scoring `scores` in order. */
function seriesGames(seriesId: string, scores: number[], overrides: Partial<Game> = {}): Game[] {
  return scores.map((totalScore, i) => makeGame({ gameId: `${seriesId}-${i}`, totalScore, isSeries: true, seriesId, ...overrides }));
}

describe('HighScoreAlertService', () => {
  let service: HighScoreAlertService;
  let alertController: { create: ReturnType<typeof vi.fn> };
  let present: ReturnType<typeof vi.fn>;

  /** Options passed to `AlertController.create` for the nth alert. */
  function alertOptions(index = 0) {
    return alertController.create.mock.calls[index][0];
  }

  /** Options of every alert whose subheader mentions a series. */
  function seriesAlerts() {
    return alertController.create.mock.calls.map((call) => call[0]).filter((options) => String(options.subHeader).includes('Series'));
  }

  /** Options of every single-game alert. */
  function singleGameAlerts() {
    return alertController.create.mock.calls.map((call) => call[0]).filter((options) => options.subHeader === 'Single Game Record');
  }

  beforeEach(() => {
    present = vi.fn().mockResolvedValue(undefined);
    alertController = { create: vi.fn().mockResolvedValue({ present }) };

    TestBed.configureTestingModule({
      providers: [{ provide: AlertController, useValue: alertController }],
    });
    service = TestBed.inject(HighScoreAlertService);
  });

  describe('checkAndDisplayHighScoreAlerts', () => {
    it('celebrates a new personal best', async () => {
      const newGame = makeGame({ gameId: 'new', totalScore: 250 });

      await service.checkAndDisplayHighScoreAlerts(newGame, [makeGame({ gameId: 'old', totalScore: 200 }), newGame]);

      expect(present).toHaveBeenCalledTimes(1);
      expect(alertOptions().header).toBe('NEW HIGH SCORE!');
      expect(alertOptions().subHeader).toBe('Single Game Record');
      expect(alertOptions().message).toContain('250');
      expect(alertOptions().message).toContain('Previous best: 200');
    });

    it('stays quiet when the score does not beat the record', async () => {
      const newGame = makeGame({ gameId: 'new', totalScore: 180 });

      await service.checkAndDisplayHighScoreAlerts(newGame, [makeGame({ gameId: 'old', totalScore: 200 }), newGame]);

      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('ignores the new game itself when working out the previous best', async () => {
      const newGame = makeGame({ gameId: 'new', totalScore: 250 });

      await service.checkAndDisplayHighScoreAlerts(newGame, [newGame]);

      expect(alertOptions().message).toContain('Your first record!');
    });

    it('lists league, patterns and balls of the record game', async () => {
      const newGame = makeGame({ gameId: 'new', totalScore: 250, league: 'Monday', patterns: ['Shark'], balls: ['Hammer'] });

      await service.checkAndDisplayHighScoreAlerts(newGame, [newGame]);

      expect(alertOptions().message).toContain('Monday');
      expect(alertOptions().message).toContain('Shark');
      expect(alertOptions().message).toContain('Hammer');
    });

    it('celebrates a series record alongside the game record', async () => {
      const games = seriesGames('s1', [200, 200, 250]);
      const previous = seriesGames('s0', [100, 100, 100]);

      await service.checkAndDisplayHighScoreAlerts(games[2], [...previous, ...games]);

      expect(alertController.create).toHaveBeenCalledTimes(2);
      expect(alertOptions(1).subHeader).toBe('3-Game Series Record');
      expect(alertOptions(1).message).toContain('650');
      expect(alertOptions(1).message).toContain('Previous best: 300');
    });

    it('compares a series only against others of the same length', async () => {
      const games = seriesGames('s1', [100, 100, 100]);
      const longer = seriesGames('s0', [200, 200, 200, 200]);

      await service.checkAndDisplayHighScoreAlerts(games[2], [...longer, ...games]);

      expect(seriesAlerts()).toHaveLength(1);
      expect(seriesAlerts()[0].message).toContain('Your first record!');
    });

    it('ignores series shorter than three games', async () => {
      const short = seriesGames('s1', [250, 250]);

      await service.checkAndDisplayHighScoreAlerts(short[1], short);

      expect(seriesAlerts()).toHaveLength(0);
    });

    it('ignores series longer than six games', async () => {
      const long = seriesGames('s1', [250, 250, 250, 250, 250, 250, 250]);

      await service.checkAndDisplayHighScoreAlerts(long[6], long);

      expect(seriesAlerts()).toHaveLength(0);
    });

    it('ignores a game that is not marked as part of a series', async () => {
      const game = makeGame({ gameId: 'g1', totalScore: 250, seriesId: 's1' });

      await service.checkAndDisplayHighScoreAlerts(game, [game]);

      expect(alertController.create).toHaveBeenCalledTimes(1);
      expect(alertOptions().subHeader).toBe('Single Game Record');
    });
  });

  describe('checkAndDisplayHighScoreAlertsForMultipleGames', () => {
    it('does nothing without new games', async () => {
      await service.checkAndDisplayHighScoreAlertsForMultipleGames([], [makeGame()]);

      expect(alertController.create).not.toHaveBeenCalled();
    });

    it('alerts once for the highest of the new games', async () => {
      const games = seriesGames('s1', [210, 250, 230]);

      await service.checkAndDisplayHighScoreAlertsForMultipleGames(games, games);

      expect(singleGameAlerts()).toHaveLength(1);
      expect(singleGameAlerts()[0].message).toContain('250');
    });

    it('alerts once per series, not once per game', async () => {
      const games = seriesGames('s1', [200, 200, 250]);

      await service.checkAndDisplayHighScoreAlertsForMultipleGames(games, games);

      expect(seriesAlerts()).toHaveLength(1);
    });

    it('measures the new games against the rest of the history', async () => {
      const games = seriesGames('s1', [150, 150, 150]);

      await service.checkAndDisplayHighScoreAlertsForMultipleGames(games, [makeGame({ gameId: 'old', totalScore: 300 }), ...games]);

      expect(singleGameAlerts()).toHaveLength(0);
    });
  });

  describe('displayHighScoreAlert', () => {
    it('renders a series record with its scores and league', async () => {
      const record: HighScoreRecord = {
        type: 'series',
        newRecord: 650,
        previousRecord: 600,
        details: { seriesType: '3-Game Series', scores: [200, 200, 250], league: 'Monday', date: '01.01.2026' },
        gameOrSeries: seriesGames('s1', [200, 200, 250]),
      };

      await service.displayHighScoreAlert(record);

      expect(alertOptions().subHeader).toBe('3-Game Series Record');
      expect(alertOptions().message).toContain('200, 200, 250');
      expect(alertOptions().message).toContain('Monday');
      expect(alertOptions().message).toContain('01.01.2026');
      expect(alertOptions().buttons[0].text).toBe('Awesome!');
    });

    it('falls back to a generic series subheader when the type is unusual', async () => {
      const record: HighScoreRecord = {
        type: 'series',
        newRecord: 650,
        previousRecord: 0,
        details: { seriesType: 'Series', scores: [650], date: '01.01.2026' },
        gameOrSeries: [],
      };

      await service.displayHighScoreAlert(record);

      expect(alertOptions().subHeader).toBe('Series Record');
    });
  });
});
