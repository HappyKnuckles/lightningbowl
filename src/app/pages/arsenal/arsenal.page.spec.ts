import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Arsenal, Ball } from 'src/app/core/models/ball.model';
import { ArsenalPickerService } from 'src/app/core/services/arsenal-picker/arsenal-picker.service';
import { Game } from 'src/app/core/models/game.model';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { ArsenalNameError, BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { ArsenalPage } from './arsenal.page';

describe('ArsenalPage', () => {
  let component: ArsenalPage;
  let fixture: ComponentFixture<ArsenalPage>;

  const arsenal = signal<Ball[]>([]);
  const cachedBalls = signal<Ball[]>([]);
  const games = signal<Game[]>([]);
  const arsenals = signal<Arsenal[]>([]);
  // the open arsenal; without one every ball counts as in it, like for a bowler with a single arsenal
  const currentArsenal = signal<Arsenal | undefined>(undefined);
  const ballsStore = {
    arsenal,
    arsenals,
    currentArsenal,
    currentArsenalBalls: computed(() => {
      const open = currentArsenal();
      return open ? arsenal().filter((ball) => open.ballIds.includes(ball.arsenalId ?? '')) : arsenal();
    }),
    activeArsenal: computed(() => arsenal().filter((ball) => !ball.retiredAt)),
    arsenalsOf: vi.fn(),
    setBallArsenals: vi.fn(),
    addBallsToArsenal: vi.fn(),
    createArsenal: vi.fn(),
    renameArsenal: vi.fn(),
    knownBalls: computed(() => [...arsenal(), ...cachedBalls()]),
    myBalls: arsenal,
    url: '',
    setBallRetired: vi.fn(),
    updateBallNotes: vi.fn(),
    reorderArsenal: vi.fn(),
  };
  const toastService = { showToast: vi.fn() };
  const arsenalPicker = { choose: vi.fn(), chooseForNewBalls: vi.fn() };

  beforeEach(() => {
    arsenal.set([]);
    cachedBalls.set([]);
    games.set([]);
    ballsStore.setBallRetired.mockReset().mockResolvedValue(undefined);
    ballsStore.updateBallNotes.mockReset().mockResolvedValue(undefined);
    ballsStore.reorderArsenal.mockReset().mockResolvedValue(undefined);
    toastService.showToast.mockReset();
    arsenals.set([]);
    currentArsenal.set(undefined);
    ballsStore.arsenalsOf.mockReset().mockReturnValue([]);
    ballsStore.setBallArsenals.mockReset().mockResolvedValue(undefined);
    ballsStore.addBallsToArsenal.mockReset().mockResolvedValue({ added: [], failed: [] });
    ballsStore.createArsenal.mockReset().mockResolvedValue(undefined);
    ballsStore.renameArsenal.mockReset().mockResolvedValue(undefined);
    arsenalPicker.choose.mockReset().mockResolvedValue(null);
    arsenalPicker.chooseForNewBalls.mockReset().mockResolvedValue(['a1']);

    TestBed.configureTestingModule({
      providers: [
        // the migrated store: the arsenal plus balls remembered from games (no full catalog on the device)
        { provide: BallsStore, useValue: ballsStore },
        { provide: ToastService, useValue: toastService },
        { provide: ArsenalPickerService, useValue: arsenalPicker },
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

  describe('arsenals', () => {
    const league: Arsenal = { id: 'a1', name: 'League', ballIds: ['zen'] };
    const tournament: Arsenal = { id: 'a2', name: 'Tournament', ballIds: ['iq'] };
    const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', arsenalId: 'zen' });
    const iq = makeBall({ ball_id: 'i', ball_name: 'IQ Tour', arsenalId: 'iq' });
    const el = () => fixture.nativeElement as HTMLElement;

    beforeEach(() => {
      arsenal.set([zen, iq]);
      arsenals.set([league, tournament]);
      currentArsenal.set(league);
      fixture.detectChanges();
    });

    it('shows the open arsenal by name, with only its balls', () => {
      expect(el().querySelector('.arsenal-title')?.textContent).toContain('League');
      expect(el().querySelector('ion-reorder-group')?.textContent).toContain('Zen');
      expect(el().querySelector('ion-reorder-group')?.textContent).not.toContain('IQ Tour');

      currentArsenal.set(tournament);
      fixture.detectChanges();

      expect(el().querySelector('.arsenal-title')?.textContent).toContain('Tournament');
      expect(el().querySelector('ion-reorder-group')?.textContent).toContain('IQ Tour');
    });

    it("covers only the open arsenal's balls in the stats", () => {
      expect(component.ballStats().map((stats) => stats.name)).toEqual(['Zen']);
    });

    it('creates and renames arsenals', async () => {
      expect(await component.saveArsenalName('Spares')).toBe(true);
      expect(ballsStore.createArsenal).toHaveBeenCalledWith('Spares');

      expect(await component.saveArsenalName('Monday', 'a1')).toBe(true);
      expect(ballsStore.renameArsenal).toHaveBeenCalledWith('a1', 'Monday');
      expect(toastService.showToast).toHaveBeenLastCalledWith(TOAST_MESSAGES.arsenalSaveSuccess, 'checkmark-outline');
    });

    it('says why a name cannot be used', async () => {
      ballsStore.createArsenal.mockRejectedValue(new ArsenalNameError('taken'));
      expect(await component.saveArsenalName('League')).toBe(false);
      expect(toastService.showToast).toHaveBeenLastCalledWith(TOAST_MESSAGES.arsenalNameTaken, 'bug', true);

      ballsStore.createArsenal.mockRejectedValue(new ArsenalNameError('missing'));
      expect(await component.saveArsenalName('')).toBe(false);
      expect(toastService.showToast).toHaveBeenLastCalledWith(TOAST_MESSAGES.arsenalNameMissing, 'bug', true);
    });

    it('changes which arsenals a ball is in', async () => {
      ballsStore.arsenalsOf.mockReturnValue(['a1']);
      arsenalPicker.choose.mockResolvedValue(['a1', 'a2']);

      await component.editBallArsenals(zen);

      expect(arsenalPicker.choose).toHaveBeenCalledWith('Arsenals for Zen', ['a1']);
      expect(ballsStore.setBallArsenals).toHaveBeenCalledWith(zen, ['a1', 'a2']);
    });

    it('leaves the ball alone when the choice is cancelled', async () => {
      await component.editBallArsenals(zen);

      expect(ballsStore.setBallArsenals).not.toHaveBeenCalled();
    });

    it('adds a new ball to the arsenals the bowler picks', async () => {
      const fresh = makeBall({ ball_id: 'n', ball_name: 'New One' });
      arsenalPicker.chooseForNewBalls.mockResolvedValue(['a1', 'a2']);

      await component.onBallSelectionChange([fresh]);

      expect(ballsStore.addBallsToArsenal).toHaveBeenCalledWith([fresh], { allowTwin: false, arsenalIds: ['a1', 'a2'] });
    });

    it('adds nothing when the bowler picks no arsenal', async () => {
      arsenalPicker.chooseForNewBalls.mockResolvedValue(null);

      await component.onBallSelectionChange([makeBall({ ball_id: 'n', ball_name: 'New One' })]);

      expect(ballsStore.addBallsToArsenal).not.toHaveBeenCalled();
    });

    it('puts a ball owned in another arsenal into this one instead of adding it again', async () => {
      ballsStore.arsenalsOf.mockReturnValue(['a2']);

      await component.onBallSelectionChange([makeBall({ ball_id: 'i', ball_name: 'IQ Tour' })]);

      expect(ballsStore.setBallArsenals).toHaveBeenCalledWith(iq, ['a2', 'a1']);
      expect(ballsStore.addBallsToArsenal).not.toHaveBeenCalled();
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
