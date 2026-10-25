import { TestBed } from '@angular/core/testing';
import { makeFrame, makeFrames, makeGame, makeThrow } from 'src/testing/fixtures';
import { GameDataTransformerService } from './game-data-transform.service';

describe('TransformGameDataService', () => {
  let service: GameDataTransformerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameDataTransformerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('ball tracking', () => {
    it('keeps the user’s selection for a game-tracked game', () => {
      const game = makeGame({ balls: ['Spare', 'Hammer'], ballTracking: 'game' });

      const result = service.transformGameData(game);

      expect(result.ballTracking).toBe('game');
      expect(result.balls).toEqual(['Hammer', 'Spare']);
    });

    it('derives balls from the throws for a throw-tracked game', () => {
      const frames = makeFrames();
      frames[0] = makeFrame(0, [makeThrow(0, [10], { ball: { name: 'IQ Tour', weight: '15' } })]);
      frames[1] = makeFrame(1, [makeThrow(0, [], { ball: { name: 'Phaze II', weight: '15' } })]);
      const game = makeGame({ frames, balls: ['Stale entry'], ballTracking: 'throw' });

      const result = service.transformGameData(game);

      expect(result.balls).toEqual(['IQ Tour15', 'Phaze II15']);
    });

    it('tags a game with per-throw balls as throw-tracked even without the flag', () => {
      const frames = makeFrames();
      frames[0] = makeFrame(0, [makeThrow(0, [], { ball: { name: 'IQ Tour', weight: '15' } })]);

      const result = service.transformGameData(makeGame({ frames }));

      expect(result.ballTracking).toBe('throw');
      expect(result.balls).toEqual(['IQ Tour15']);
    });

    it('tags a game with no ball data at all as game-tracked', () => {
      const result = service.transformGameData(makeGame({ balls: [] }));

      expect(result.ballTracking).toBe('game');
    });
  });
});
