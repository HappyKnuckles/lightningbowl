import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { BallLayout } from 'src/app/core/models/ball.model';
import { BowlerFit } from 'src/app/core/models/fit.model';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let store: SettingsStore;
  let storageRepository: SpyObj<StorageRepository>;

  beforeEach(() => {
    localStorage.removeItem('pin-input-mode');
    localStorage.removeItem('ball-tracking');
    storageRepository = createSpyObj<StorageRepository>(['get', 'set', 'remove']);
    storageRepository.get.mockResolvedValue(null);
    storageRepository.set.mockResolvedValue(undefined);
    storageRepository.remove.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: StorageRepository, useValue: storageRepository }] });
    store = TestBed.inject(SettingsStore);
  });

  afterEach(() => {
    localStorage.removeItem('pin-input-mode');
    localStorage.removeItem('ball-tracking');
  });

  describe('loadPinInputMode', () => {
    it('enables pin mode when hit input was stored', () => {
      localStorage.setItem('pin-input-mode', 'hit');

      store.loadPinInputMode();

      expect(store.pinInputMode()).toBe(true);
    });

    it('disables pin mode for the missing-pin setting', () => {
      localStorage.setItem('pin-input-mode', 'missing');

      store.loadPinInputMode();

      expect(store.pinInputMode()).toBe(false);
    });

    it('defaults to disabled when nothing was stored yet', () => {
      store.loadPinInputMode();

      expect(store.pinInputMode()).toBe(false);
    });
  });

  describe('savePinInputMode', () => {
    it('stores the hit mode and turns pin mode on', () => {
      store.savePinInputMode('hit');

      expect(store.pinInputMode()).toBe(true);
      expect(localStorage.getItem('pin-input-mode')).toBe('hit');
    });

    it('normalises anything else to the missing mode', () => {
      store.savePinInputMode('something else');

      expect(store.pinInputMode()).toBe(false);
      expect(localStorage.getItem('pin-input-mode')).toBe('missing');
    });
  });

  describe('loadBallTracking', () => {
    it('defaults to per-throw when nothing was stored yet', () => {
      store.loadBallTracking();

      expect(store.ballTracking()).toBe('throw');
    });

    it('loads the per-game preference when explicitly stored', () => {
      localStorage.setItem('ball-tracking', 'game');

      store.loadBallTracking();

      expect(store.ballTracking()).toBe('game');
    });

    it('loads the per-throw preference when explicitly stored', () => {
      localStorage.setItem('ball-tracking', 'throw');

      store.loadBallTracking();

      expect(store.ballTracking()).toBe('throw');
    });
  });

  describe('saveBallTracking', () => {
    it('stores the game mode and updates the signal', () => {
      store.saveBallTracking('game');

      expect(store.ballTracking()).toBe('game');
      expect(localStorage.getItem('ball-tracking')).toBe('game');
    });

    it('normalises anything else to the game mode', () => {
      store.saveBallTracking('something else');

      expect(store.ballTracking()).toBe('game');
      expect(localStorage.getItem('ball-tracking')).toBe('game');
    });
  });

  describe('fit', () => {
    const fit: BowlerFit = { grip: 'fingertip', middleSpan: 4.125, ringSpan: 4.25, papOver: 5.25, papVertical: 0.75 };

    it('loads the stored fit', async () => {
      storageRepository.get.mockResolvedValue(fit);

      await store.loadFit();

      expect(storageRepository.get).toHaveBeenCalledWith('bowler_fit');
      expect(store.fit()).toEqual(fit);
    });

    it('stays empty when nothing was stored or loading fails', async () => {
      await store.loadFit();
      expect(store.fit()).toBeUndefined();

      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      storageRepository.get.mockRejectedValue(new Error('storage down'));
      await store.loadFit();
      expect(store.fit()).toBeUndefined();
    });

    it('saves the fit', async () => {
      await store.saveFit(fit);

      expect(storageRepository.set).toHaveBeenCalledWith('bowler_fit', fit);
      expect(store.fit()).toEqual(fit);
    });

    it('removes the record when the fit is cleared', async () => {
      await store.saveFit(fit);
      await store.saveFit(undefined);

      expect(storageRepository.remove).toHaveBeenCalledWith('bowler_fit');
      expect(store.fit()).toBeUndefined();
    });
  });

  describe('layout presets', () => {
    const presets: BallLayout[] = [{ system: 'dual-angle', drillingAngle: 60, pinToPap: 5, valAngle: 45 }];

    it('loads the stored presets, empty when nothing was stored', async () => {
      await store.loadLayoutPresets();
      expect(store.layoutPresets()).toEqual([]);

      storageRepository.get.mockResolvedValue(presets);
      await store.loadLayoutPresets();

      expect(storageRepository.get).toHaveBeenCalledWith('layout_presets');
      expect(store.layoutPresets()).toEqual(presets);
    });

    it('saves the presets', async () => {
      await store.saveLayoutPresets(presets);

      expect(storageRepository.set).toHaveBeenCalledWith('layout_presets', presets);
      expect(store.layoutPresets()).toEqual(presets);
    });
  });
});
