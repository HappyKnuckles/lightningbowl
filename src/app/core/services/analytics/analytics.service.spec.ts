import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { vi } from 'vitest';

import { environment } from 'src/environments/environment';

import { AnalyticsService } from './analytics.service';

/** The queue internals the tests drive directly (tracking itself is off outside production). */
interface QueueInternals {
  addToQueue: (payload: { appId: string; eventType: string }) => Promise<void>;
  flushBeforeUnload: () => Promise<void>;
  getQueue: () => Promise<{ id: string; payload: { eventType: string } }[]>;
  processQueue: () => Promise<void>;
  scheduleBatchFlush: () => void;
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let queue: QueueInternals;
  let http: HttpTestingController;
  const event = (eventType: string) => ({ appId: 'lightning-bowl', eventType });
  const types = async () => (await queue.getQueue()).map((e) => e.payload.eventType);

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    const storage = TestBed.inject(Storage);
    await storage.create();
    await storage.set('analytics_queue', []);
    service = TestBed.inject(AnalyticsService);
    queue = service as unknown as QueueInternals;
    // sent by the tests, not by the debounce timer
    queue.scheduleBatchFlush = vi.fn();
    http = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('keeps both of two events tracked at the same moment', async () => {
    // e.g. saving a game, and the navigation that follows
    await Promise.all([queue.addToQueue(event('game_saved')), queue.addToQueue(event('performance_navigation'))]);

    expect(await types()).toEqual(['game_saved', 'performance_navigation']);
  });

  it('keeps events tracked while a batch is on its way', async () => {
    await queue.addToQueue(event('game_saved'));
    const sending = queue.processQueue();
    let request: TestRequest | undefined;
    // `match` takes the request off the list, so keep it once found
    await vi.waitFor(() => {
      request ??= http.match(`${environment.analyticsEndpoint}events/batch`)[0];
      expect(request).toBeDefined();
    });

    await queue.addToQueue(event('ball_search'));
    request!.flush({ success: true, count: 1 });
    await sending;

    expect(await types()).toEqual(['ball_search']);
  });

  it('sends the beacon as plain text, so no preflight can stop it, and keeps what came after', async () => {
    await queue.addToQueue(event('game_saved'));
    const beacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    await queue.flushBeforeUnload();

    const body = beacon.mock.calls[0][1] as Blob;
    expect(body.type).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(await body.text()).events.map((e: { eventType: string }) => e.eventType)).toEqual(['game_saved']);
    expect(await types()).toEqual([]);
    vi.restoreAllMocks();
  });
});
