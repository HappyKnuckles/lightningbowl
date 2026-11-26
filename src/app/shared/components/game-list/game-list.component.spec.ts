import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, IonModal } from '@ionic/angular/lazy';

import { GameEditService } from 'src/app/core/services/game-edit/game-edit.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { GameListComponent } from './game-list.component';
import { makeFrame, makeFrames, makeGame, makeThrow } from 'src/testing/fixtures';
import { vi } from 'vitest';

const mockGamesStore = {
  games: vi.fn().mockReturnValue([]),
  deleteGame: vi.fn().mockReturnValue(Promise.resolve()),
  saveGameToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
  saveGamesToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
  updateGamesInMemory: vi.fn(),
};

const mockBallsStore = {
  allBalls: vi.fn().mockReturnValue([]),
  arsenal: vi.fn().mockReturnValue([]),
};

const mockSettingsStore = {
  pinInputMode: vi.fn().mockReturnValue(true),
};

const mockPatternsStore = {
  allPatterns: vi.fn().mockReturnValue([]),
};

const mockLeaguesStore = {
  leagues: vi.fn().mockReturnValue([]),
};

describe('GameListComponent', () => {
  let component: GameListComponent;
  let fixture: ComponentFixture<GameListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameListComponent],
      providers: [
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: PatternsStore, useValue: mockPatternsStore },
        { provide: LeaguesStore, useValue: mockLeaguesStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('games', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('game-level ball selection', () => {
    const modal = { dismiss: vi.fn() } as unknown as IonModal;
    const throwTrackedGame = () =>
      makeGame({
        gameId: 'g1',
        isPinMode: false,
        ballTracking: 'throw',
        frames: [makeFrame(0, [makeThrow(0, [], { ball: { name: 'Phaze II' } })]), ...makeFrames().slice(1)],
      });

    /** Answers the replace prompt with the given role and returns the `create` spy. */
    const answerPrompt = (role: 'confirm' | 'cancel') => {
      const alert = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role }) };
      return vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(alert as never);
    };

    it('applies the selection without asking when no throw carries a ball', async () => {
      const create = answerPrompt('cancel');
      const game = makeGame({ gameId: 'g1' });

      expect(await component.onBallSelect([{ name: 'Hammer', weight: '15' }], game, modal)).toBe(true);

      expect(create).not.toHaveBeenCalled();
      expect(game).toMatchObject({ balls: [{ name: 'Hammer', weight: '15' }], ballTracking: 'game' });
    });

    it('replaces the per-throw balls once confirmed', async () => {
      answerPrompt('confirm');
      const game = throwTrackedGame();

      expect(await component.onBallSelect([{ name: 'Hammer', weight: '15' }], game, modal)).toBe(true);

      expect(game).toMatchObject({ balls: [{ name: 'Hammer', weight: '15' }], ballTracking: 'game' });
      expect(game.frames[0].throws[0].ball).toBeUndefined();
    });

    it('keeps the game per-throw when the prompt is cancelled', async () => {
      answerPrompt('cancel');
      const game = throwTrackedGame();

      expect(await component.onBallSelect([{ name: 'Hammer', weight: '15' }], game, modal)).toBe(false);

      expect(game.ballTracking).toBe('throw');
      expect(game.balls).toBeUndefined();
      expect(game.frames[0].throws[0].ball).toEqual({ name: 'Phaze II' });
    });
  });

  describe('editing the league', () => {
    type SeriesRow = Parameters<GameListComponent['toggleSeriesEdit']>[0];
    const series = (): SeriesRow => {
      const games = [1, 2, 3].map((n) =>
        makeGame({ gameId: `g${n}`, isSeries: true, seriesId: 's1', league: 'Monday Night League', patterns: ['Badger'] }),
      );
      return { kind: 'series', id: 'series-g1', games, count: 3, total: 600, avg: 200, firstNumber: 1, lastNumber: 3 };
    };

    beforeEach(() => vi.clearAllMocks());

    it("keeps a series' new league and patterns as a draft, leaving the games where they are until Save", () => {
      const row = series();
      component.toggleSeriesEdit(row);

      component.onSeriesLeagueChanged('City Classic');
      component.onSeriesPatternsChanged(['Cheetah']);

      expect(component.seriesDraft()).toEqual({ rowId: 'series-g1', league: 'City Classic', patterns: ['Cheetah'] });
      expect(mockGamesStore.updateGamesInMemory).not.toHaveBeenCalled();
      expect(row.games.map((g) => g.league)).toEqual(['Monday Night League', 'Monday Night League', 'Monday Night League']);
    });

    it('saves the draft to the whole series and closes the edit', async () => {
      const save = vi.spyOn(fixture.debugElement.injector.get(GameEditService), 'saveSeriesFields').mockResolvedValue();
      const row = series();
      component.toggleSeriesEdit(row);
      component.onSeriesLeagueChanged('City Classic');

      await component.saveSeriesEdit(row);

      expect(save).toHaveBeenCalledWith(row.games[0], 'City Classic', ['Badger']);
      expect(component.editingSeriesId()).toBeNull();
    });

    it('drops the draft on cancel, without saving anything', () => {
      const save = vi.spyOn(fixture.debugElement.injector.get(GameEditService), 'saveSeriesFields');
      component.toggleSeriesEdit(series());
      component.onSeriesLeagueChanged('City Classic');

      component.cancelSeriesEdit();

      expect(component.seriesDraft()).toBeNull();
      expect(save).not.toHaveBeenCalled();
    });

    it('changes only the edited game when its league is picked, not the store', () => {
      const game = makeGame({ gameId: 'g9', league: 'Monday Night League' });

      component.onEditLeagueChanged(game, 'City Classic');

      expect(game.league).toBe('City Classic');
      expect(mockGamesStore.updateGamesInMemory).not.toHaveBeenCalled();
    });
  });

  describe('saving a lone series game with a new league', () => {
    const answer = (role: 'confirm' | 'cancel') => {
      const alert = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role }) };
      return vi.spyOn(TestBed.inject(AlertController), 'create').mockResolvedValue(alert as never);
    };
    const edit = () => {
      const games = [1, 2, 3].map((n) => makeGame({ gameId: `g${n}`, isSeries: true, seriesId: 's1', league: 'Monday Night League' }));
      mockGamesStore.games.mockReturnValue(games);
      const editService = fixture.debugElement.injector.get(GameEditService);
      editService.startEdit(games[0]);
      component.onEditLeagueChanged(games[0], 'City Classic');
      return { game: games[0], save: vi.spyOn(editService, 'saveEdit').mockResolvedValue(true) };
    };

    afterEach(() => mockGamesStore.games.mockReturnValue([]));

    it('asks first, naming how many games the change reaches', async () => {
      const create = answer('confirm');
      const { game, save } = edit();

      await component.saveEdit(game);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Change the whole series?',
          message: 'This game is part of a 3-game series. The new league will apply to all 3 games.',
        }),
      );
      expect(save).toHaveBeenCalledWith(game);
    });

    it('keeps editing without saving when the user cancels', async () => {
      answer('cancel');
      const { game, save } = edit();

      await component.saveEdit(game);

      expect(save).not.toHaveBeenCalled();
    });

    it('saves a game outside a series without asking', async () => {
      const create = answer('confirm');
      const game = makeGame({ gameId: 'g9', league: 'Monday Night League' });
      const editService = fixture.debugElement.injector.get(GameEditService);
      editService.startEdit(game);
      component.onEditLeagueChanged(game, 'City Classic');
      const save = vi.spyOn(editService, 'saveEdit').mockResolvedValue(true);

      await component.saveEdit(game);

      expect(create).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledWith(game);
    });
  });
});
