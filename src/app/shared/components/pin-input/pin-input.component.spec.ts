import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PINS } from 'src/app/core/constants/app.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { ThrowBall } from 'src/app/core/models/game.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { makeBall } from 'src/testing/fixtures';
import { PinInputComponent, ThrowConfirmedEvent } from './pin-input.component';

describe('PinInputComponent', () => {
  let component: PinInputComponent;
  let fixture: ComponentFixture<PinInputComponent>;

  const allBalls = signal<Ball[]>([]);
  const arsenal = signal<Ball[]>([]);
  const saveBallsToArsenal = vi.fn<(balls: Ball[]) => Promise<Ball[]>>();
  const showToast = vi.fn();

  const host = (): HTMLElement => fixture.nativeElement;

  /** Every rendered pin button, in layout order (7-8-9-10, 4-5-6, 2-3, 1). */
  const pinButtons = (): HTMLElement[] => Array.from(host().querySelectorAll<HTMLElement>('.pin-deck .pin'));

  /** The pin button carrying `pinNumber`, whatever row it sits in. */
  const pinButton = (pinNumber: number): HTMLElement => {
    const button = pinButtons().find((el) => el.textContent?.trim() === String(pinNumber));
    if (!button) throw new Error(`No pin button rendered for pin ${pinNumber}`);
    return button;
  };

  /**
   * Ionic reflects `disabled` to the attribute on its own render cycle, so the
   * property is what the binding has actually set by the time a spec looks.
   */
  const isDisabled = (el: HTMLElement): boolean => (el as HTMLElement & { disabled?: boolean }).disabled === true;

  /** The shortcut buttons ("X", "/", "-"), wherever the template outlet put them. */
  const shortcutButton = (label: string): HTMLElement => {
    const button = Array.from(host().querySelectorAll<HTMLElement>('ion-button')).find((el) => el.textContent?.trim() === label);
    if (!button) throw new Error(`No shortcut button rendered for "${label}"`);
    return button;
  };

  beforeEach(async () => {
    allBalls.set([]);
    arsenal.set([]);
    saveBallsToArsenal.mockReset().mockResolvedValue([]);
    showToast.mockReset();

    await TestBed.configureTestingModule({
      imports: [PinInputComponent],
      providers: [
        { provide: BallsStore, useValue: { allBalls, arsenal, saveBallsToArsenal, url: '' } },
        { provide: ToastService, useValue: { showToast } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PinInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onBallAdd', () => {
    const iq = makeBall({ ball_id: 'b1', ball_name: 'IQ Tour', core_weight: '15' });
    const phaze = makeBall({ ball_id: 'b2', ball_name: 'Phaze II', core_weight: '15' });

    beforeEach(() => allBalls.set([iq, phaze]));

    it('saves every selected ball to the arsenal, not just the first', async () => {
      await component.onBallAdd(['b1', 'b2']);

      expect(saveBallsToArsenal).toHaveBeenCalledWith([iq, phaze]);
    });

    it('uses the ball straight away when only one was added', async () => {
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1']);

      expect(emitted).toEqual([{ name: 'IQ Tour', weight: '15' }]);
      expect(component.isBallModalOpen()).toBe(false);
    });

    it('asks which ball to use when several were added', async () => {
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1', 'b2']);

      expect(emitted).toEqual([]);
      expect(component.isBallModalOpen()).toBe(true);
    });

    it('still offers the balls that saved when one of them failed', async () => {
      saveBallsToArsenal.mockResolvedValue([phaze]);
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1', 'b2']);

      expect(emitted).toEqual([{ name: 'IQ Tour', weight: '15' }]);
    });

    it('does nothing when the selection matches no known ball', async () => {
      await component.onBallAdd(['nope']);

      expect(saveBallsToArsenal).not.toHaveBeenCalled();
    });
  });

  describe('pin rows', () => {
    it('lays the deck out back row first', () => {
      expect(component.pinRows().map((row) => row.map((pin) => pin.number))).toEqual([[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]]);
      expect(pinButtons().map((el) => el.textContent?.trim())).toEqual(['7', '8', '9', '10', '4', '5', '6', '2', '3', '1']);
    });

    it('marks pins that are no longer standing as knocked down and disabled', () => {
      fixture.componentRef.setInput('pinsLeftStanding', [1, 5]);
      fixture.detectChanges();

      const pins = component.pinRows().flat();

      expect(pins.filter((pin) => !pin.knockedDown).map((pin) => pin.number)).toEqual([5, 1]);
      expect(pins.filter((pin) => pin.disabled).map((pin) => pin.number)).toEqual([7, 8, 9, 10, 4, 6, 2, 3]);
      expect(pinButton(7).classList).toContain('knocked-down');
      expect(pinButton(5).classList).not.toContain('knocked-down');
    });

    it('disables the whole deck once the game is complete', () => {
      fixture.componentRef.setInput('inputLocked', true);
      fixture.detectChanges();

      expect(
        component
          .pinRows()
          .flat()
          .every((pin) => pin.disabled),
      ).toBe(true);
    });

    it('dims a selected pin in hit mode — you tap what you knocked down', () => {
      fixture.componentRef.setInput('selectHitPins', true);
      component.togglePin(5);
      fixture.detectChanges();

      const pins = component.pinRows().flat();

      expect(pins.find((pin) => pin.number === 5)?.active).toBe(false);
      expect(pins.find((pin) => pin.number === 1)?.active).toBe(true);
      expect(pinButton(5).classList).not.toContain('active');
    });

    it('lights a selected pin in leave mode — you tap what is left standing', () => {
      fixture.componentRef.setInput('selectHitPins', false);
      component.togglePin(5);
      fixture.detectChanges();

      const pins = component.pinRows().flat();

      expect(pins.find((pin) => pin.number === 5)?.active).toBe(true);
      expect(pins.find((pin) => pin.number === 1)?.active).toBe(false);
      expect(pinButton(5).classList).toContain('active');
    });
  });

  describe('togglePin', () => {
    it('selects and deselects a standing pin', () => {
      component.togglePin(3);
      expect(component.selectedPins()).toEqual([3]);
      expect(component.hasSelection()).toBe(true);

      component.togglePin(3);
      expect(component.selectedPins()).toEqual([]);
      expect(component.hasSelection()).toBe(false);
    });

    it('ignores pins that are already down', () => {
      fixture.componentRef.setInput('pinsLeftStanding', [1, 2]);
      fixture.detectChanges();

      component.togglePin(7);

      expect(component.selectedPins()).toEqual([]);
    });

    it('ignores taps once the game is complete', () => {
      fixture.componentRef.setInput('inputLocked', true);
      fixture.detectChanges();

      component.togglePin(1);

      expect(component.selectedPins()).toEqual([]);
    });

    it('selects on click', () => {
      pinButton(10).click();
      fixture.detectChanges();

      expect(component.selectedPins()).toEqual([10]);
    });
  });

  describe('confirmThrow', () => {
    it('emits the selected pins in hit mode', () => {
      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.togglePin(1);
      component.togglePin(3);
      component.confirmThrow();

      expect(emitted).toEqual([{ pinsKnockedDown: [1, 3] }]);
    });

    it('emits the complement of the selection in leave mode', () => {
      fixture.componentRef.setInput('selectHitPins', false);
      fixture.componentRef.setInput('pinsLeftStanding', [1, 2, 3, 4]);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.togglePin(2);
      component.confirmThrow();

      expect(emitted).toEqual([{ pinsKnockedDown: [1, 3, 4] }]);
    });

    it('emits an empty miss when nothing is selected in hit mode', () => {
      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.confirmThrow();

      expect(emitted).toEqual([{ pinsKnockedDown: [] }]);
    });

    it('clears the selection so the next throw starts fresh', () => {
      component.togglePin(6);
      component.confirmThrow();

      expect(component.selectedPins()).toEqual([]);
    });

    it('does not emit a copy of the standing pins array', () => {
      fixture.componentRef.setInput('selectHitPins', false);
      const standing = [1, 2, 3];
      fixture.componentRef.setInput('pinsLeftStanding', standing);
      fixture.detectChanges();

      let emitted: number[] | undefined;
      component.throwConfirmed.subscribe((event) => (emitted = event.pinsKnockedDown));

      component.confirmThrow();

      expect(emitted).toEqual([1, 2, 3]);
      expect(emitted).not.toBe(standing);
    });

    it('emits nothing once the game is complete', () => {
      fixture.componentRef.setInput('inputLocked', true);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.confirmThrow();

      expect(emitted).toEqual([]);
    });
  });

  describe('score shortcuts', () => {
    it('records a strike as every standing pin when allowed', () => {
      fixture.componentRef.setInput('canStrike', true);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.togglePin(1);
      component.recordStrike();

      expect(emitted).toEqual([{ pinsKnockedDown: PINS }]);
      expect(component.selectedPins()).toEqual([]);
    });

    it('records a spare as the remaining standing pins when allowed', () => {
      fixture.componentRef.setInput('canSpare', true);
      fixture.componentRef.setInput('pinsLeftStanding', [4, 7]);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.recordSpare();

      expect(emitted).toEqual([{ pinsKnockedDown: [4, 7] }]);
    });

    it('records a gutter as no pins at all', () => {
      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.togglePin(5);
      component.recordGutter();

      expect(emitted).toEqual([{ pinsKnockedDown: [] }]);
      expect(component.selectedPins()).toEqual([]);
    });

    it('stays silent when the shortcut is not available', () => {
      fixture.componentRef.setInput('canStrike', false);
      fixture.componentRef.setInput('canSpare', false);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.recordStrike();
      component.recordSpare();

      expect(emitted).toEqual([]);
    });

    it('stays silent once the game is complete', () => {
      fixture.componentRef.setInput('canStrike', true);
      fixture.componentRef.setInput('canSpare', true);
      fixture.componentRef.setInput('inputLocked', true);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.recordStrike();
      component.recordSpare();
      component.recordGutter();

      expect(emitted).toEqual([]);
    });

    it('disables the shortcuts the frame does not allow', () => {
      expect(isDisabled(shortcutButton('X'))).toBe(true);
      expect(isDisabled(shortcutButton('/'))).toBe(true);

      fixture.componentRef.setInput('canStrike', true);
      fixture.detectChanges();

      expect(isDisabled(shortcutButton('X'))).toBe(false);
    });
  });

  describe('clear and undo', () => {
    it('clears the selection without emitting a throw', () => {
      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      component.togglePin(2);
      component.clearSelectedPins();

      expect(component.selectedPins()).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it('drops the selection and asks the parent to undo', () => {
      let undos = 0;
      component.undoRequested.subscribe(() => undos++);

      component.togglePin(9);
      component.undoLastThrow();

      expect(component.selectedPins()).toEqual([]);
      expect(undos).toBe(1);
    });
  });

  describe('stats button', () => {
    it('is hidden unless the series asks for it', () => {
      expect(host().querySelector('.stats-btn')).toBeNull();

      fixture.componentRef.setInput('showStatsButton', true);
      fixture.componentRef.setInput('statsEnabled', true);
      fixture.detectChanges();

      expect(host().querySelector('.stats-btn')).not.toBeNull();
    });

    it('is disabled while there are no live stats to show', () => {
      fixture.componentRef.setInput('showStatsButton', true);
      fixture.componentRef.setInput('statsEnabled', false);
      fixture.detectChanges();

      expect(isDisabled(host().querySelector<HTMLElement>('.stats-btn')!)).toBe(true);
    });

    it('emits statsClick when tapped', () => {
      fixture.componentRef.setInput('showStatsButton', true);
      fixture.componentRef.setInput('statsEnabled', true);
      fixture.detectChanges();

      let clicks = 0;
      component.statsClick.subscribe(() => clicks++);

      host().querySelector<HTMLElement>('.stats-btn')!.click();

      expect(clicks).toBe(1);
    });
  });

  describe('sheet layout', () => {
    /** The `.quick-actions` row that holds the "X" / "/" / "-" shortcuts. */
    const shortcutRowIndex = (): number => {
      const rows = Array.from(host().querySelectorAll<HTMLElement>('.quick-actions'));
      return rows.findIndex((row) => Array.from(row.querySelectorAll('ion-button')).some((el) => el.textContent?.trim() === 'X'));
    };

    it('keeps everything in the single row below the deck inline', () => {
      expect(host().querySelector('.pin-input-container')!.classList).not.toContain('sheet');
      expect(host().querySelectorAll('.quick-actions').length).toBe(1);
      expect(shortcutRowIndex()).toBe(0);
    });

    it('lifts the shortcuts into their own row above the deck as a sheet', () => {
      fixture.componentRef.setInput('sheet', true);
      fixture.detectChanges();

      const rows = host().querySelectorAll<HTMLElement>('.quick-actions');

      expect(host().querySelector('.pin-input-container')!.classList).toContain('sheet');
      expect(rows.length).toBe(2);
      expect(shortcutRowIndex()).toBe(0);
      expect(rows[0].compareDocumentPosition(host().querySelector('.pin-deck')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('renders the shortcuts exactly once in either layout', () => {
      const shortcutCount = (): number =>
        Array.from(host().querySelectorAll<HTMLElement>('ion-button')).filter((el) => ['X', '/', '-'].includes(el.textContent?.trim() ?? '')).length;

      expect(shortcutCount()).toBe(3);

      fixture.componentRef.setInput('sheet', true);
      fixture.detectChanges();

      expect(shortcutCount()).toBe(3);
    });

    it('drives the same throws from the sheet layout', () => {
      fixture.componentRef.setInput('sheet', true);
      fixture.detectChanges();

      const emitted: ThrowConfirmedEvent[] = [];
      component.throwConfirmed.subscribe((event) => emitted.push(event));

      pinButton(1).click();
      pinButton(3).click();
      fixture.detectChanges();
      component.confirmThrow();

      expect(emitted).toEqual([{ pinsKnockedDown: [1, 3] }]);
    });
  });
});
