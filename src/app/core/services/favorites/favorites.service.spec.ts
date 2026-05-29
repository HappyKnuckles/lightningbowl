import { TestBed } from '@angular/core/testing';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FavoritesService);
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Pattern Favorites', () => {
    it('should toggle favorite status', () => {
      const patternUrl = 'test-pattern-url';

      // Initially should not be favorite
      expect(service.isFavorite(patternUrl)).toBe(false);

      // Toggle to favorite
      const firstToggle = service.toggleFavorite(patternUrl);
      expect(firstToggle).toBe(true);
      expect(service.isFavorite(patternUrl)).toBe(true);

      // Toggle back to not favorite
      const secondToggle = service.toggleFavorite(patternUrl);
      expect(secondToggle).toBe(false);
      expect(service.isFavorite(patternUrl)).toBe(false);
    });

    it('should persist favorites in localStorage', () => {
      const patternUrl1 = 'pattern-1';
      const patternUrl2 = 'pattern-2';

      service.addFavorite(patternUrl1);
      service.addFavorite(patternUrl2);

      // Create new instance to test persistence
      const newService = new FavoritesService();

      expect(newService.isFavorite(patternUrl1)).toBe(true);
      expect(newService.isFavorite(patternUrl2)).toBe(true);
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('favoritePatterns', 'invalid-json');

      const newService = new FavoritesService();
      expect(newService.getFavoritePatternUrls()).toEqual([]);
    });
  });

  describe('Ball Favorites', () => {
    it('should toggle ball favorite status', () => {
      const ballId = 'test-ball-id';
      const coreWeight = '15lb';

      // Initially should not be favorite
      expect(service.isBallFavorite(ballId, coreWeight)).toBe(false);

      // Toggle to favorite
      const firstToggle = service.toggleBallFavorite(ballId, coreWeight);
      expect(firstToggle).toBe(true);
      expect(service.isBallFavorite(ballId, coreWeight)).toBe(true);

      // Toggle back to not favorite
      const secondToggle = service.toggleBallFavorite(ballId, coreWeight);
      expect(secondToggle).toBe(false);
      expect(service.isBallFavorite(ballId, coreWeight)).toBe(false);
    });

    it('should persist ball favorites in localStorage', () => {
      const ballId1 = 'ball-1';
      const coreWeight1 = '15lb';
      const ballId2 = 'ball-2';
      const coreWeight2 = '16lb';

      service.addBallFavorite(ballId1, coreWeight1);
      service.addBallFavorite(ballId2, coreWeight2);

      // Create new instance to test persistence
      const newService = new FavoritesService();

      expect(newService.isBallFavorite(ballId1, coreWeight1)).toBe(true);
      expect(newService.isBallFavorite(ballId2, coreWeight2)).toBe(true);
    });

    it('should handle invalid ball favorites localStorage data gracefully', () => {
      localStorage.setItem('favoriteBalls', 'invalid-json');

      const newService = new FavoritesService();
      expect(newService.getFavoriteBallKeys()).toEqual([]);
    });

    it('should use correct ball key format', () => {
      const ballId = 'test-ball-123';
      const coreWeight = '15lb';

      service.addBallFavorite(ballId, coreWeight);

      const keys = service.getFavoriteBallKeys();
      expect(keys).toContain('test-ball-123-15lb');
    });
  });

  it('should handle both pattern and ball favorites independently', () => {
    const patternUrl = 'test-pattern';
    const ballId = 'test-ball';
    const coreWeight = '15lb';

    service.addFavorite(patternUrl);
    service.addBallFavorite(ballId, coreWeight);

    expect(service.isFavorite(patternUrl)).toBe(true);
    expect(service.isBallFavorite(ballId, coreWeight)).toBe(true);

    service.removeFavorite(patternUrl);
    expect(service.isFavorite(patternUrl)).toBe(false);
    expect(service.isBallFavorite(ballId, coreWeight)).toBe(true);
  });
});
