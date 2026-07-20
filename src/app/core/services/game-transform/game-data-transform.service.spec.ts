import { TestBed } from '@angular/core/testing';
import { Game } from 'src/app/core/models/game.model';
import { GameDataTransformerService } from './game-data-transform.service';

describe('TransformGameDataService', () => {
  let service: GameDataTransformerService;

  const makeGame = (overrides: Partial<Game> = {}): Game => ({
    gameId: '',
    date: 0,
    frames: [],
    frameScores: [],
    totalScore: 120,
    isClean: false,
    isPerfect: false,
    isPractice: false,
    isPinMode: false,
    patterns: [],
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameDataTransformerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('passes the owning bowler through to the persisted game', () => {
    const result = service.transformGameData(makeGame({ bowlerId: 'b1' }));
    expect(result.bowlerId).toBe('b1');
  });

  it('leaves bowlerId undefined when the source game has none', () => {
    const result = service.transformGameData(makeGame());
    expect(result.bowlerId).toBeUndefined();
  });
});
