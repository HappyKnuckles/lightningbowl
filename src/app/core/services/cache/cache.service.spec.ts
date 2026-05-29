import { TestBed } from '@angular/core/testing';
import { CacheService } from './cache.service';
import { Storage } from '@ionic/storage-angular';

describe('CacheService', () => {
  let service: CacheService;
  let storageSpy: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('Storage', ['set', 'get', 'remove', 'keys']);

    TestBed.configureTestingModule({
      providers: [{ provide: Storage, useValue: spy }],
    });

    service = TestBed.inject(CacheService);
    storageSpy = TestBed.inject(Storage) as jasmine.SpyObj<Storage>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set cache data with metadata', async () => {
    const testData = { test: 'value' };
    const cacheKey = 'test_key';

    storageSpy.set.and.returnValue(Promise.resolve());

    await service.set(cacheKey, testData);

    expect(storageSpy.set).toHaveBeenCalledWith(
      `cache_${cacheKey}`,
      jasmine.objectContaining({
        data: testData,
        metadata: jasmine.objectContaining({
          lastUpdated: jasmine.any(Number),
          version: '1.0',
          expires: jasmine.any(Number),
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

    storageSpy.get.and.returnValue(Promise.resolve(mockCacheEntry));

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

    storageSpy.get.and.returnValue(Promise.resolve(mockCacheEntry));
    storageSpy.remove.and.returnValue(Promise.resolve());

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

    storageSpy.get.and.returnValue(
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

    storageSpy.get.and.returnValue(
      Promise.resolve({
        data: {},
        metadata: mockMetadata,
      }),
    );

    const isStale = await service.isStale(cacheKey);
    expect(isStale).toBe(true);
  });
});
