import { TestBed } from '@angular/core/testing';

import { Ball } from 'src/app/core/models/ball.model';
import { BallSortField, BallSortOption, SortDirection } from 'src/app/core/models/sort.model';
import { FavoritesService } from 'src/app/core/services/favorites/favorites.service';
import { makeBall } from 'src/testing/fixtures';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';

import { BallSortService } from './ball-sort.service';

function option(field: BallSortField, direction = SortDirection.ASC): BallSortOption {
  return { field, direction, label: `${field} ${direction}` };
}

describe('BallSortService', () => {
  let service: BallSortService;
  let favoritesService: SpyObj<FavoritesService>;

  beforeEach(() => {
    favoritesService = createSpyObj<FavoritesService>(['getFavoriteBalls']);
    favoritesService.getFavoriteBalls.mockReturnValue([]);

    TestBed.configureTestingModule({
      providers: [{ provide: FavoritesService, useValue: favoritesService }],
    });
    service = TestBed.inject(BallSortService);
  });

  it('offers both directions for every sortable field', () => {
    expect(service.BALL_SORT_OPTIONS.length).toBeGreaterThan(0);
    expect(service.BALL_SORT_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });

  describe('sortBalls', () => {
    const balls: Ball[] = [
      makeBall({ ball_id: 'b1', ball_name: 'Zen', brand_name: 'Storm', release_date: '2024-01-01', core_rg: '2.55', core_diff: '0.050' }),
      makeBall({ ball_id: 'b2', ball_name: 'alpha', brand_name: 'Hammer', release_date: '2026-01-01', core_rg: '2.48', core_diff: '0.030' }),
      makeBall({ ball_id: 'b3', ball_name: 'Match', brand_name: 'Motiv', release_date: '2025-01-01', core_rg: '2.51', core_diff: '0.040' }),
    ];

    it('sorts names case-insensitively', () => {
      const sorted = service.sortBalls(balls, option(BallSortField.BALL_NAME));

      expect(sorted.map((b) => b.ball_name)).toEqual(['alpha', 'Match', 'Zen']);
    });

    it('reverses on a descending option', () => {
      const sorted = service.sortBalls(balls, option(BallSortField.BALL_NAME, SortDirection.DESC));

      expect(sorted.map((b) => b.ball_name)).toEqual(['Zen', 'Match', 'alpha']);
    });

    it('sorts numeric core values as numbers', () => {
      const sorted = service.sortBalls(balls, option(BallSortField.CORE_RG));

      expect(sorted.map((b) => b.core_rg)).toEqual(['2.48', '2.51', '2.55']);
    });

    it('treats an unparsable numeric value as zero', () => {
      const withBlank = [...balls, makeBall({ ball_id: 'b4', core_diff: 'n/a' })];

      const sorted = service.sortBalls(withBlank, option(BallSortField.CORE_DIFF));

      expect(sorted[0].ball_id).toBe('b4');
    });

    it('sorts release dates chronologically', () => {
      const sorted = service.sortBalls(balls, option(BallSortField.RELEASE_DATE, SortDirection.DESC));

      expect(sorted.map((b) => b.ball_id)).toEqual(['b2', 'b3', 'b1']);
    });

    it('does not mutate the input array', () => {
      service.sortBalls(balls, option(BallSortField.BALL_NAME));

      expect(balls.map((b) => b.ball_id)).toEqual(['b1', 'b2', 'b3']);
    });

    it('puts favorites first, each group sorted on its own', () => {
      favoritesService.getFavoriteBalls.mockReturnValue([balls[0], balls[2]]);

      const sorted = service.sortBalls(balls, option(BallSortField.BALL_NAME), true);

      expect(sorted.map((b) => b.ball_name)).toEqual(['Match', 'Zen', 'alpha']);
    });

    it('matches favorites on ball and weight together', () => {
      const fifteen = makeBall({ ball_id: 'b1', core_weight: '15', ball_name: 'Zen' });
      const fourteen = makeBall({ ball_id: 'b1', core_weight: '14', ball_name: 'Zen' });
      favoritesService.getFavoriteBalls.mockReturnValue([fifteen]);

      const sorted = service.sortBalls([fourteen, fifteen], option(BallSortField.BALL_NAME), true);

      expect(sorted.map((b) => b.core_weight)).toEqual(['15', '14']);
    });

    it('ignores favorites when the flag is off', () => {
      favoritesService.getFavoriteBalls.mockReturnValue([balls[0]]);

      const sorted = service.sortBalls(balls, option(BallSortField.BALL_NAME));

      expect(sorted.map((b) => b.ball_name)).toEqual(['alpha', 'Match', 'Zen']);
      expect(favoritesService.getFavoriteBalls).not.toHaveBeenCalled();
    });
  });
});
