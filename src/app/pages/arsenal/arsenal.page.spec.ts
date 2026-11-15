import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { ArsenalPage } from './arsenal.page';

describe('ArsenalPage', () => {
  let component: ArsenalPage;
  let fixture: ComponentFixture<ArsenalPage>;

  const arsenal = signal<Ball[]>([]);
  const cachedBalls = signal<Ball[]>([]);
  const games = signal<Game[]>([]);
  const ballsStore = {
    arsenal,
    activeArsenal: computed(() => arsenal().filter((ball) => !ball.retiredAt)),
    retiredBalls: computed(() => arsenal().filter((ball) => !!ball.retiredAt)),
    knownBalls: computed(() => [...arsenal(), ...cachedBalls()]),
    myBalls: arsenal,
    url: '',
    setBallRetired: vi.fn(),
    updateBallNotes: vi.fn(),
    reorderArsenal: vi.fn(),
  };
  const toastService = { showToast: vi.fn() };

  beforeEach(() => {
    arsenal.set([]);
    cachedBalls.set([]);
    games.set([]);
    ballsStore.setBallRetired.mockReset().mockResolvedValue(undefined);
    ballsStore.updateBallNotes.mockReset().mockResolvedValue(undefined);
    ballsStore.reorderArsenal.mockReset().mockResolvedValue(undefined);
    toastService.showToast.mockReset();

    TestBed.configureTestingModule({
      providers: [
        // the migrated store: the arsenal plus balls remembered from games (no full catalog on the device)
        { provide: BallsStore, useValue: ballsStore },
        { provide: ToastService, useValue: toastService },
        { provide: GamesStore, useValue: { games } },
      ],
    });

    fixture = TestBed.createComponent(ArsenalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('retired balls', () => {
    const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', arsenalId: 'zen' });
    const old = makeBall({ ball_id: 'o', ball_name: 'Old Faithful', arsenalId: 'old', retiredAt: Date.UTC(2026, 0, 5, 12) });
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    it('lists them in their own section, apart from the balls in use', () => {
      arsenal.set([zen, old]);
      fixture.detectChanges();

      const retired = (fixture.nativeElement as HTMLElement).querySelector('.retired');
      expect(retired?.textContent).toContain('Retired (1)');
      expect(retired?.textContent).toContain('Old Faithful');
      expect(retired?.textContent).toContain('retired 01.05.2026');
      expect(retired?.textContent).not.toContain('Zen');
      expect((fixture.nativeElement as HTMLElement).querySelector('ion-reorder-group')?.textContent).not.toContain('Old Faithful');
    });

    it('shows no section without retired balls', () => {
      arsenal.set([zen]);
      fixture.detectChanges();

      expect(text()).not.toContain('Retired');
    });

    it('retires and restores a ball', async () => {
      await component.setRetired(zen, true);
      expect(ballsStore.setBallRetired).toHaveBeenCalledWith(zen, true);
      expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.ballRetireSuccess, 'checkmark-outline');

      await component.setRetired(old, false);
      expect(ballsStore.setBallRetired).toHaveBeenCalledWith(old, false);
      expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.ballRestoreSuccess, 'checkmark-outline');
    });

    it('does nothing for a ball that is already in that state', async () => {
      await component.setRetired(old, true);

      expect(ballsStore.setBallRetired).not.toHaveBeenCalled();
    });

    it('tells the user when retiring fails', async () => {
      ballsStore.setBallRetired.mockRejectedValue(new Error('storage down'));

      await component.setRetired(zen, true);

      expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.ballRetireError, 'bug', true);
    });

    it('reorders only the balls in use', async () => {
      const iq = makeBall({ ball_id: 'i', ball_name: 'IQ Tour', arsenalId: 'iq' });
      arsenal.set([zen, old, iq]);
      const complete = vi.fn();

      await component.reorderArsenal({ detail: { from: 1, to: 0, complete } } as never);

      expect(complete).toHaveBeenCalled();
      expect(ballsStore.reorderArsenal).toHaveBeenCalledWith([iq, zen]);
    });
  });

  describe('notes', () => {
    const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', arsenalId: 'zen', nickname: 'benchmark', note: 'sanded' });

    it('saves the changed field and keeps the other', async () => {
      await component.onNotesChange(zen, 'note', 'polished');

      expect(ballsStore.updateBallNotes).toHaveBeenCalledWith(zen, { nickname: 'benchmark', note: 'polished' });
    });

    it('shows the nickname in the list', () => {
      arsenal.set([zen]);
      fixture.detectChanges();

      expect(component.ballTags()).toEqual({ zen: 'benchmark' });
      expect((fixture.nativeElement as HTMLElement).querySelector('ion-reorder-group')?.textContent).toContain('benchmark');
    });

    it('tells the user when saving fails', async () => {
      ballsStore.updateBallNotes.mockRejectedValue(new Error('storage down'));

      await component.onNotesChange(zen, 'nickname', 'x');

      expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.ballNotesSaveError, 'bug', true);
    });
  });

  describe('ballStats', () => {
    const hammer = makeBall({ ball_id: 'b1', ball_name: 'Hammer', core_weight: '15' });
    const iq = makeBall({ ball_id: 'b2', ball_name: 'IQ Tour', core_weight: '15' });

    it('leaves out balls that are no longer in the arsenal', () => {
      arsenal.set([hammer]);
      cachedBalls.set([hammer, iq]);
      games.set([
        makeGame({ gameId: 'g1', totalScore: 200, balls: [{ name: 'Hammer', weight: '15' }] }),
        makeGame({ gameId: 'g2', totalScore: 180, balls: [{ name: 'IQ Tour', weight: '15' }] }),
      ]);

      expect(component.ballStats().map((stats) => stats.name)).toEqual(['Hammer']);
    });

    it('includes an owned ball that has never been thrown', () => {
      arsenal.set([hammer, iq]);
      cachedBalls.set([hammer, iq]);
      games.set([makeGame({ gameId: 'g1', totalScore: 200, balls: [{ name: 'Hammer', weight: '15' }] })]);

      const never = component.ballStats().find((stats) => stats.name === 'IQ Tour');

      expect(never).toBeDefined();
      expect(never?.gameCount).toBe(0);
    });

    it('does not list an owned ball twice once it has been thrown', () => {
      arsenal.set([hammer]);
      cachedBalls.set([hammer]);
      games.set([makeGame({ gameId: 'g1', totalScore: 200, balls: [{ name: 'Hammer', weight: '15' }] })]);

      const stats = component.ballStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].gameCount).toBe(1);
    });

    it('ignores the game filter so the numbers cover all time', () => {
      arsenal.set([hammer]);
      cachedBalls.set([hammer]);
      games.set([
        makeGame({ gameId: 'g1', totalScore: 200, balls: [{ name: 'Hammer', weight: '15' }], isPractice: true }),
        makeGame({ gameId: 'g2', totalScore: 100, balls: [{ name: 'Hammer', weight: '15' }], league: 'Monday' }),
      ]);

      expect(component.ballStats()[0].gameCount).toBe(2);
    });
  });
});
