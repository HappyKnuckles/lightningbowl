import { TestBed } from '@angular/core/testing';

import { Alley } from 'src/app/core/models/alley.model';

import { AlleyFavoritesService } from './alley-favorites.service';

function alley(id: string, name = `Alley ${id}`): Alley {
  return { id, name, lat: 50, lon: 8 };
}

describe('AlleyFavoritesService', () => {
  function createService(): AlleyFavoritesService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(AlleyFavoritesService);
  }

  beforeEach(() => {
    localStorage.removeItem('favoriteAlleys');
    localStorage.removeItem('recentAlleys');
  });

  afterEach(() => {
    localStorage.removeItem('favoriteAlleys');
    localStorage.removeItem('recentAlleys');
  });

  describe('toggleFavorite', () => {
    it('adds an alley and reports it as favorited', () => {
      const service = createService();

      expect(service.toggleFavorite(alley('node/1'))).toBe(true);
      expect(service.isFavorite('node/1')).toBe(true);
      expect(service.favorites().get('node/1')?.name).toBe('Alley node/1');
    });

    it('removes an alley that is already favorited', () => {
      const service = createService();
      service.toggleFavorite(alley('node/1'));

      expect(service.toggleFavorite(alley('node/1'))).toBe(false);
      expect(service.isFavorite('node/1')).toBe(false);
    });

    it('persists favorites for the next session', () => {
      createService().toggleFavorite(alley('node/1'));

      expect(createService().isFavorite('node/1')).toBe(true);
    });
  });

  describe('addRecent', () => {
    it('puts the newest alley first', () => {
      const service = createService();

      service.addRecent(alley('node/1'));
      service.addRecent(alley('node/2'));

      expect(service.recents().map((a) => a.id)).toEqual(['node/2', 'node/1']);
    });

    it('moves an alley visited again back to the front without duplicating it', () => {
      const service = createService();
      service.addRecent(alley('node/1'));
      service.addRecent(alley('node/2'));

      service.addRecent(alley('node/1'));

      expect(service.recents().map((a) => a.id)).toEqual(['node/1', 'node/2']);
    });

    it('keeps at most ten recent alleys', () => {
      const service = createService();

      for (let i = 1; i <= 12; i++) {
        service.addRecent(alley(`node/${i}`));
      }

      expect(service.recents()).toHaveLength(10);
      expect(service.recents()[0].id).toBe('node/12');
    });

    it('persists recents for the next session', () => {
      createService().addRecent(alley('node/1'));

      expect(
        createService()
          .recents()
          .map((a) => a.id),
      ).toEqual(['node/1']);
    });
  });

  describe('loading from storage', () => {
    it('starts empty when nothing was stored', () => {
      const service = createService();

      expect(service.favorites().size).toBe(0);
      expect(service.recents()).toEqual([]);
    });

    it('survives corrupted storage', () => {
      localStorage.setItem('favoriteAlleys', 'not json');

      const service = createService();

      expect(service.favorites().size).toBe(0);
    });
  });
});
