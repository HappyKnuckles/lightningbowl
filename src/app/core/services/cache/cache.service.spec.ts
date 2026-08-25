import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';

import { createSpyObj, SpyObj } from '../../../../testing/spy-obj';
import { DEFAULT_CACHE_CONFIG } from '../../models/cache.model';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let storageSpy: SpyObj<Storage>;

  beforeEach(() => {
    const spy = createSpyObj(['set', 'get', 'remove', 'keys']);

    TestBed.configureTestingModule({
      providers: [{ provide: Storage, useValue: spy }],
    });

    service = TestBed.inject(CacheService);
    storageSpy = TestBed.inject(Storage) as SpyObj<Storage>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set cache data with metadata', async () => {
    const testData = { test: 'value' };
    const cacheKey = 'test_key';

    storageSpy.set.mockReturnValue(Promise.resolve());

    await service.set(cacheKey, testData);

    expect(storageSpy.set).toHaveBeenCalledWith(
      `cache_${cacheKey}`,
      expect.objectContaining({
        data: testData,
        metadata: expect.objectContaining({
          lastUpdated: expect.any(Number),
          version: '1.0',
          expires: expect.any(Number),
        }),
      }),
    );
  });

  it('should get valid cached data', async () => {
    const testData = { test: 'value' };
    const cacheKey = 'test_key';
    const now = Date.now();
    const mockCacheEntry = {
      data: testData,
      metadata: {
        lastUpdated: now,
        version: '1.0',
        expires: now + 1000 * 60 * 60, // 1 hour from now
      },
    };

    storageSpy.get.mockReturnValue(Promise.resolve(mockCacheEntry));

    const result = await service.get(cacheKey);

    expect(result).toEqual(testData);
    expect(storageSpy.get).toHaveBeenCalledWith(`cache_${cacheKey}`);
  });

  it('should return null for expired cache data', async () => {
    const testData = { test: 'value' };
    const cacheKey = 'test_key';
    const now = Date.now();
    const mockCacheEntry = {
      data: testData,
      metadata: {
        lastUpdated: now - 1000 * 60 * 60 * 2, // 2 hours ago
        version: '1.0',
        expires: now - 1000 * 60 * 60, // 1 hour ago (expired)
      },
    };

    storageSpy.get.mockReturnValue(Promise.resolve(mockCacheEntry));
    storageSpy.remove.mockReturnValue(Promise.resolve());

    const result = await service.get(cacheKey);

    expect(result).toBeNull();
    expect(storageSpy.remove).toHaveBeenCalledWith(`cache_${cacheKey}`);
  });

  it('should check if cache is valid', async () => {
    const cacheKey = 'test_key';
    const now = Date.now();
    const mockMetadata = {
      lastUpdated: now,
      version: '1.0',
      expires: now + 1000 * 60 * 60, // 1 hour from now
    };

    storageSpy.get.mockReturnValue(
      Promise.resolve({
        data: {},
        metadata: mockMetadata,
      }),
    );

    const isValid = await service.isValid(cacheKey);
    expect(isValid).toBe(true);
  });

  it('should detect stale cache data', async () => {
    const cacheKey = 'test_key';
    const now = Date.now();
    const mockMetadata = {
      lastUpdated: now - 1000 * 60 * 60 * 25, // 25 hours ago
      version: '1.0',
      expires: now + 1000 * 60 * 60, // 1 hour from now (not expired but stale)
    };

    storageSpy.get.mockReturnValue(
      Promise.resolve({
        data: {},
        metadata: mockMetadata,
      }),
    );

    const isStale = await service.isStale(cacheKey);
    expect(isStale).toBe(true);
  });

  it('should not report freshly cached data as stale', async () => {
    const cacheKey = 'test_key';
    const now = Date.now();

    storageSpy.get.mockReturnValue(
      Promise.resolve({
        data: {},
        metadata: {
          lastUpdated: now - 1000 * 60 * 60, // 1 hour ago
          version: '1.0',
          expires: now + 1000 * 60 * 60 * 23,
        },
      }),
    );

    const isStale = await service.isStale(cacheKey);
    expect(isStale).toBe(false);
  });

  // Guards the stale-while-revalidate path in balls.store / patterns.store: `get()` has
  // already dropped anything past `defaultTTL`, so a `maxAge` at or above it would leave
  // `isStale` permanently false and the background refresh unreachable.
  it('should keep the staleness window below the hard TTL', () => {
    expect(DEFAULT_CACHE_CONFIG.maxAge).toBeLessThan(DEFAULT_CACHE_CONFIG.defaultTTL);
  });
});
