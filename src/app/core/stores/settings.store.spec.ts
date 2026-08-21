import { TestBed } from '@angular/core/testing';

import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let store: SettingsStore;

  beforeEach(() => {
    localStorage.removeItem('pin-input-mode');
    TestBed.configureTestingModule({});
    store = TestBed.inject(SettingsStore);
  });

  afterEach(() => {
    localStorage.removeItem('pin-input-mode');
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
});
