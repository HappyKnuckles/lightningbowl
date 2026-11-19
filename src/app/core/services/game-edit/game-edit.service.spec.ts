import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { GamesStore } from 'src/app/core/stores/games.store';
import { makeFrame, makeFrames, makeGame, makeThrow } from 'src/testing/fixtures';

import { GameEditService } from './game-edit.service';

describe('GameEditService', () => {
  let service: GameEditService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GameEditService] });
    service = TestBed.inject(GameEditService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('countThrowBalls / clearThrowBalls', () => {
    const gameWithThrowBalls = () =>
      makeGame({
        gameId: 'g1',
        isPinMode: true,
        frames: [makeFrame(0, [makeThrow(0, [], { ball: { name: 'Phaze II' } })]), ...makeFrames().slice(1)],
      });

    it('clears the game itself outside an edit', () => {
      const game = gameWithThrowBalls();

      service.clearThrowBalls(game);

      expect(service.countThrowBalls(game)).toBe(0);
      expect(game.frames[0].throws[0].value).toBe(10);
    });

    it('clears only the edit in progress, so cancelling restores the balls', () => {
      const game = gameWithThrowBalls();
      service.startEdit(game);

      service.clearThrowBalls(game);

      expect(service.countThrowBalls(game)).toBe(0);
      expect(service.getEditedGame('g1')!.frames[0].throws[0].ball).toBeUndefined();
      expect(game.frames[0].throws[0].ball).toEqual({ name: 'Phaze II' });
    });
  });

  describe('league of a game in a series', () => {
    /** A complete game (all strikes), so it passes validation on save. */
    const perfectFrames = () => [
      ...Array.from({ length: 9 }, (_, i) => makeFrame(i, [makeThrow(0, [])])),
      makeFrame(9, [makeThrow(0, []), makeThrow(1, []), makeThrow(2, [])]),
    ];
    const seriesGames = () =>
      [1, 2, 3].map((n) =>
        makeGame({ gameId: `g${n}`, isSeries: true, seriesId: 's1', league: 'Monday Night League', frames: perfectFrames(), totalScore: 300 }),
      );

    it('leaves the store alone on cancel', () => {
      const store = TestBed.inject(GamesStore);
      const inMemory = vi.spyOn(store, 'updateGamesInMemory');
      const [game] = seriesGames();
      service.startEdit(game);
      game.league = 'City Classic';

      service.cancelEdit(game);

      expect(game.league).toBe('Monday Night League');
      expect(inMemory).not.toHaveBeenCalled();
    });

    it('moves the whole series to the new league on save', async () => {
      const store = TestBed.inject(GamesStore);
      const games = seriesGames();
      vi.spyOn(store, 'games').mockReturnValue(games);
      const saveOne = vi.spyOn(store, 'saveGameToLocalStorage').mockResolvedValue();
      const saveMany = vi.spyOn(store, 'saveGamesToLocalStorage').mockResolvedValue();
      const [game] = games;
      service.startEdit(game);
      game.league = 'City Classic';

      expect(await service.saveEdit(game)).toBe(true);

      expect(saveOne).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'g1', league: 'City Classic' }));
      expect(saveMany.mock.calls[0][0].map((g) => [g.gameId, g.league])).toEqual([
        ['g2', 'City Classic'],
        ['g3', 'City Classic'],
      ]);
    });
  });
});
