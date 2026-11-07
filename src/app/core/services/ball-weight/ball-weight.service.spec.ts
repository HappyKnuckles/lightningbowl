import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { vi } from 'vitest';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { BallWeightService } from './ball-weight.service';

describe('BallWeightService', () => {
  const phaze12 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '12' });
  const phaze15 = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
  const zen15 = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15' });

  let service: BallWeightService;
  let options: Map<string, Ball[]>;
  let complete: boolean;
  let arsenal: Ball[];
  let games: ReturnType<typeof signal<Game[]>>;
  let stored: Record<string, unknown>;
  /** What the bowler picks in the modal; undefined closes it without data. */
  let answer: Map<string, Ball> | undefined;
  let create: ReturnType<typeof vi.fn>;
  let rememberBalls: ReturnType<typeof vi.fn>;
  let saveGameToLocalStorage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    options = new Map();
    complete = true;
    arsenal = [];
    games = signal<Game[]>([]);
    stored = {};
    answer = new Map();
    create = vi.fn(async () => ({ present: vi.fn(async () => undefined), onWillDismiss: vi.fn(async () => ({ data: answer })) }));
    rememberBalls = vi.fn(async () => undefined);
    saveGameToLocalStorage = vi.fn(async () => undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: ModalController, useValue: { create } },
        {
          provide: BallsStore,
          useValue: {
            arsenal: () => arsenal,
            rememberBalls,
            weightOptions: vi.fn(async (names: string[]) => ({ options: new Map(names.map((name) => [name, options.get(name) ?? []])), complete })),
          },
        },
        { provide: GamesStore, useValue: { games, saveGameToLocalStorage } },
        {
          provide: StorageRepository,
          useValue: {
            get: vi.fn(async (key: string) => stored[key] ?? null),
            set: vi.fn(async (key: string, value: unknown) => {
              stored[key] = value;
            }),
          },
        },
      ],
    });
    service = TestBed.inject(BallWeightService);
  });

  /** The questions the last modal asked. */
  const asked = () => create.mock.calls.at(-1)?.[0].componentProps.questions;

  describe('askWeights', () => {
    it('asks about every name without a weight, with the arsenal weight picked to start with', async () => {
      options.set('Phaze II', [phaze12, phaze15]);
      arsenal = [phaze15];
      answer = new Map([['phaze ii', phaze12]]);

      const chosen = await service.askWeights(['Phaze II', 'Phaze II', 'Zen15'], 'Import');

      expect(asked()).toEqual([{ name: 'Phaze II', options: [phaze12, phaze15], owned: phaze15 }]);
      expect(create.mock.calls[0][0].componentProps.confirmText).toBe('Import');
      expect(chosen).toEqual(new Map([['phaze ii', phaze12]]));
      expect(rememberBalls).toHaveBeenCalledWith([phaze12]);
    });

    it('does not ask about a ball the catalog has in one weight only, nor about unknown balls', async () => {
      options.set('Zen', [zen15]);

      const chosen = await service.askWeights(['Zen', 'Mystery']);

      expect(create).not.toHaveBeenCalled();
      expect(chosen).toEqual(new Map([['zen', zen15]]));
    });

    it('offline, asks even about a single known weight: the ball may come in more', async () => {
      complete = false;
      options.set('Zen', [zen15]);

      await service.askWeights(['Zen']);

      expect(asked()).toEqual([{ name: 'Zen', options: [zen15], owned: undefined }]);
    });

    it('lifts the loading screen while asking, and restores it afterwards', async () => {
      options.set('Phaze II', [phaze12, phaze15]);
      const loading = TestBed.inject(LoadingService);
      loading.setLoading(true);
      let loadingWhileAsked: boolean | undefined;
      create.mockImplementation(async () => ({
        present: vi.fn(async () => (loadingWhileAsked = loading.isLoading())),
        onWillDismiss: vi.fn(async () => ({ data: answer })),
      }));

      await service.askWeights(['Phaze II'], 'Import');

      expect(loadingWhileAsked).toBe(false);
      expect(loading.isLoading()).toBe(true);
    });

    it('remembers skipped names, so the startup question leaves them alone', async () => {
      options.set('Phaze II', [phaze12, phaze15]);
      answer = undefined;

      expect((await service.askWeights(['Phaze II'])).size).toBe(0);
      expect(stored['ball_weight_skipped']).toEqual(['phaze ii']);
    });
  });

  describe('askForStoredGames', () => {
    it("asks about the games' weightless balls and writes the picked weights into those games only", async () => {
      const bare = makeGame({ gameId: 'a', balls: ['Phaze II'] });
      const weighed = makeGame({ gameId: 'b', balls: ['Zen15'] });
      games.set([bare, weighed]);
      options.set('Phaze II', [phaze12, phaze15]);
      answer = new Map([['phaze ii', phaze15]]);

      await service.askForStoredGames();

      expect(saveGameToLocalStorage).toHaveBeenCalledExactlyOnceWith({ ...bare, balls: ['Phaze II15'] });
    });

    it('asks only once: skipped names are not asked again', async () => {
      games.set([makeGame({ balls: ['Phaze II'] })]);
      options.set('Phaze II', [phaze12, phaze15]);
      stored['ball_weight_skipped'] = ['phaze ii'];

      await service.askForStoredGames();

      expect(create).not.toHaveBeenCalled();
      expect(saveGameToLocalStorage).not.toHaveBeenCalled();
    });
  });
});
