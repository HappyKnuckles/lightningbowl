import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Ball, BallPage } from 'src/app/core/models/ball.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { makeBall } from 'src/testing/fixtures';
import { BallService } from '../ball/ball.service';
import { NetworkService } from '../network/network.service';
import { BallFilterService } from './ball-filter.service';

describe('BallFilterService', () => {
  let service: BallFilterService;
  let online: boolean;
  const searchBalls = vi.fn<(params: Record<string, string | string[]>) => Promise<BallPage>>();
  const knownBalls = signal<Ball[]>([]);

  beforeEach(() => {
    online = true;
    searchBalls.mockReset();
    knownBalls.set([makeBall({ ball_id: 'a', brand_name: 'Storm' }), makeBall({ ball_id: 'b', brand_name: 'Hammer' })]);
    TestBed.configureTestingModule({
      providers: [
        { provide: BallService, useValue: { searchBalls } },
        {
          provide: NetworkService,
          useValue: {
            get isOnline() {
              return online;
            },
          },
        },
        { provide: BallsStore, useValue: { knownBalls, arsenal: signal<Ball[]>([]) } },
      ],
    });
    service = TestBed.inject(BallFilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('countMatches', () => {
    it('online, counts the whole catalog through the ball API', async () => {
      searchBalls.mockResolvedValue({ content: [], page: { number: 0, size: 1, totalElements: 1234, totalPages: 1234 } });

      const count = await service.countMatches({ ...service.defaultFilters, brands: ['Storm'] });

      expect(count).toBe(1234);
      expect(searchBalls).toHaveBeenCalledWith(expect.objectContaining({ brand: ['Storm'], size: '1', page: '0' }));
      expect(searchBalls.mock.calls[0][0]['sort']).toBeUndefined();
    });

    it('offline, counts the known balls', async () => {
      online = false;

      expect(await service.countMatches({ ...service.defaultFilters, brands: ['Storm'] })).toBe(1);
      expect(searchBalls).not.toHaveBeenCalled();
    });

    it('falls back to the known balls when the request fails', async () => {
      searchBalls.mockRejectedValue(new Error('offline'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await service.countMatches({ ...service.defaultFilters })).toBe(2);
    });
  });
});
