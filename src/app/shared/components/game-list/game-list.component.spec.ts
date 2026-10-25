import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController, IonModal } from '@ionic/angular';

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

      expect(await component.onBallSelect(['Hammer15'], game, modal)).toBe(true);

      expect(create).not.toHaveBeenCalled();
      expect(game).toMatchObject({ balls: ['Hammer15'], ballTracking: 'game' });
    });

    it('replaces the per-throw balls once confirmed', async () => {
      answerPrompt('confirm');
      const game = throwTrackedGame();

      expect(await component.onBallSelect(['Hammer15'], game, modal)).toBe(true);

      expect(game).toMatchObject({ balls: ['Hammer15'], ballTracking: 'game' });
      expect(game.frames[0].throws[0].ball).toBeUndefined();
    });

    it('keeps the game per-throw when the prompt is cancelled', async () => {
      answerPrompt('cancel');
      const game = throwTrackedGame();

      expect(await component.onBallSelect(['Hammer15'], game, modal)).toBe(false);

      expect(game.ballTracking).toBe('throw');
      expect(game.balls).toBeUndefined();
      expect(game.frames[0].throws[0].ball).toEqual({ name: 'Phaze II' });
    });
  });
});
