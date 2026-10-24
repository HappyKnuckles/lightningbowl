import { TestBed } from '@angular/core/testing';
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
});
