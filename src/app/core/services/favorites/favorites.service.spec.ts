import { TestBed } from '@angular/core/testing';
import { Ball } from '../../models/ball.model';
import { Pattern } from '../../models/pattern.model';
import { FavoritesService } from './favorites.service';

function makeBall(ballId: string, coreWeight: string): Ball {
  return {
    ball_id: ballId,
    core_weight: coreWeight,
    ball_name: ballId,
    brand_id: '',
    brand_name: '',
    ball_image: '',
    thumbnail_image: '',
    core_id: '',
    core_name: '',
    core_image: '',
    core_rg: '',
    core_diff: '',
    core_int_diff: '',
    core_type: '',
    coverstock_id: '',
    coverstock_name: '',
    coverstock_type: '',
    factory_finish: '',
    availability: '',
    release_date: '',
    last_update: '',
    us_int: '',
  };
}

function makePattern(url: string): Pattern {
  return {
    url,
    title: url,
    category: '',
    distance: '',
    volume: '',
    forward: '',
    reverse: '',
    pump: '',
    pdf_url: '',
    kosi_url: '',
    forwards_data: [],
    reverse_data: [],
    chart_standard: '',
    chart_horizontal: '',
  };
}

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
      const pattern = makePattern('test-pattern-url');

      // Initially should not be favorite
      expect(service.isFavorite(pattern.url)).toBe(false);

      // Toggle to favorite
      const firstToggle = service.toggleFavorite(pattern);
      expect(firstToggle).toBe(true);
      expect(service.isFavorite(pattern.url)).toBe(true);

      // Toggle back to not favorite
      const secondToggle = service.toggleFavorite(pattern);
      expect(secondToggle).toBe(false);
      expect(service.isFavorite(pattern.url)).toBe(false);
    });

    it('should persist favorites in localStorage', () => {
      const pattern1 = makePattern('pattern-1');
      const pattern2 = makePattern('pattern-2');

      service.addFavorite(pattern1);
      service.addFavorite(pattern2);

      // Create new instance to test persistence
      const newService = new FavoritesService();

      expect(newService.isFavorite(pattern1.url)).toBe(true);
      expect(newService.isFavorite(pattern2.url)).toBe(true);
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('favoritePatterns', 'invalid-json');

      const newService = new FavoritesService();
      expect(newService.getFavoritePatternUrls()).toEqual([]);
    });
  });

  describe('Ball Favorites', () => {
    it('should toggle ball favorite status', () => {
      const ball = makeBall('test-ball-id', '15lb');

      expect(service.isBallFavorite(ball.ball_id, ball.core_weight)).toBe(false);

      const firstToggle = service.toggleBallFavorite(ball);
      expect(firstToggle).toBe(true);
      expect(service.isBallFavorite(ball.ball_id, ball.core_weight)).toBe(true);

      const secondToggle = service.toggleBallFavorite(ball);
      expect(secondToggle).toBe(false);
      expect(service.isBallFavorite(ball.ball_id, ball.core_weight)).toBe(false);
    });

    it('should persist ball favorites in localStorage', () => {
      const ball1 = makeBall('ball-1', '15lb');
      const ball2 = makeBall('ball-2', '16lb');

      service.addBallFavorite(ball1);
      service.addBallFavorite(ball2);

      const newService = new FavoritesService();

      expect(newService.isBallFavorite(ball1.ball_id, ball1.core_weight)).toBe(true);
      expect(newService.isBallFavorite(ball2.ball_id, ball2.core_weight)).toBe(true);
    });

    it('should handle invalid ball favorites localStorage data gracefully', () => {
      localStorage.setItem('favoriteBalls', 'invalid-json');

      const newService = new FavoritesService();
      expect(newService.getFavoriteBallKeys()).toEqual([]);
    });

    it('should use correct ball key format', () => {
      service.addBallFavorite(makeBall('test-ball-123', '15lb'));

      expect(service.getFavoriteBallKeys()).toContain('test-ball-123-15lb');
    });
  });

  it('should handle both pattern and ball favorites independently', () => {
    const pattern = makePattern('test-pattern');
    const ball = makeBall('test-ball', '15lb');

    service.addFavorite(pattern);
    service.addBallFavorite(ball);

    expect(service.isFavorite(pattern.url)).toBe(true);
    expect(service.isBallFavorite(ball.ball_id, ball.core_weight)).toBe(true);

    service.removeFavorite(pattern.url);
    expect(service.isFavorite(pattern.url)).toBe(false);
    expect(service.isBallFavorite(ball.ball_id, ball.core_weight)).toBe(true);
  });
});
