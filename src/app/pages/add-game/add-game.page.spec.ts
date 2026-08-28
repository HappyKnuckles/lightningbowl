import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SegmentCustomEvent } from '@ionic/angular';
import { vi } from 'vitest';

import { GamesStore } from 'src/app/core/stores/games.store';

import { AddGamePage } from './add-game.page';

const mockGamesStore = {
  games: vi.fn().mockReturnValue([]),
  saveGameToLocalStorage: vi.fn().mockReturnValue(Promise.resolve()),
};

describe('AddGamePage', () => {
  let component: AddGamePage;
  let fixture: ComponentFixture<AddGamePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddGamePage],
      providers: [{ provide: GamesStore, useValue: mockGamesStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddGamePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('pin input sheet', () => {
    /**
     * A page tap landing on something nested inside `container` (a tag name or a
     * `.class`), the way a real tap hits a child of the element that matters.
     */
    const tapOn = (container: string): void => {
      const isClass = container.startsWith('.');
      const parent = document.createElement(isClass ? 'div' : container);
      if (isClass) parent.classList.add(container.slice(1));

      const target = document.createElement('span');
      parent.appendChild(target);

      component.onPageTap({ target } as unknown as MouseEvent);
    };

    it('starts closed', () => {
      expect(component.pinSheetOpen()).toBe(false);
    });

    it('opens on a reachable score cell and remembers the game tapped', () => {
      component.onScoreCellClick({ frameIndex: 0, throwIndex: 0 }, 0);

      expect(component.pinSheetOpen()).toBe(true);
      expect(component.getCurrentFrameIndex(0)).toBe(0);
      expect(component.getCurrentThrowIndex(0)).toBe(0);
    });

    it('stays shut for a cell the frame has not reached yet', () => {
      component.onScoreCellClick({ frameIndex: 0, throwIndex: 1 }, 0);

      expect(component.pinSheetOpen()).toBe(false);
    });

    it('stays shut in classic grid mode', () => {
      component.isPinInputMode = false;

      component.onScoreCellClick({ frameIndex: 0, throwIndex: 0 }, 0);

      expect(component.pinSheetOpen()).toBe(false);
    });

    it('moves the current throw to the cell that was tapped', () => {
      component.onPinThrowConfirmed({ pinsKnockedDown: [1, 2, 3] }, 0);
      component.onScoreCellClick({ frameIndex: 0, throwIndex: 1 }, 0);

      expect(component.pinSheetOpen()).toBe(true);
      expect(component.getCurrentFrameIndex(0)).toBe(0);
      expect(component.getCurrentThrowIndex(0)).toBe(1);
    });

    it('closes when the finished game leaves nothing to throw', () => {
      component.pinSheetOpen.set(true);
      vi.spyOn(component, 'isGameComplete').mockReturnValue(true);

      component.onPinThrowConfirmed({ pinsKnockedDown: [] }, 0);

      expect(component.pinSheetOpen()).toBe(false);
    });

    it('stays up between throws of an unfinished game', () => {
      component.pinSheetOpen.set(true);

      component.onPinThrowConfirmed({ pinsKnockedDown: [1, 2, 3, 4, 5] }, 0);

      expect(component.pinSheetOpen()).toBe(true);
    });

    it('closes when the user taps elsewhere on the page', () => {
      component.pinSheetOpen.set(true);

      tapOn('.some-other-control');

      expect(component.pinSheetOpen()).toBe(false);
    });

    it('ignores taps inside the deck itself', () => {
      component.pinSheetOpen.set(true);

      tapOn('app-pin-input');

      expect(component.pinSheetOpen()).toBe(true);
    });

    it('ignores taps on a score cell, which opens the sheet on its own', () => {
      component.pinSheetOpen.set(true);

      tapOn('.score-cell');

      expect(component.pinSheetOpen()).toBe(true);
    });

    it('does nothing on a tap while the sheet is already down', () => {
      tapOn('.some-other-control');

      expect(component.pinSheetOpen()).toBe(false);
    });

    it('closes when the series switches to another game', () => {
      component.pinSheetOpen.set(true);

      component.onSegmentChange({ detail: { value: 'Game 2' } } as SegmentCustomEvent);

      expect(component.pinSheetOpen()).toBe(false);
    });
  });

  describe('activeSegmentIndex', () => {
    it('is the position of the selected segment', () => {
      component.segments = ['Game 1', 'Game 2', 'Game 3'];
      component.onSegmentChange({ detail: { value: 'Game 3' } } as SegmentCustomEvent);

      expect(component.activeSegmentIndex).toBe(2);
    });

    it('falls back to the first game when the segment is unknown', () => {
      component.segments = ['Game 1', 'Game 2'];
      component.onSegmentChange({ detail: { value: 'Game 9' } } as SegmentCustomEvent);

      expect(component.activeSegmentIndex).toBe(0);
    });
  });
});
