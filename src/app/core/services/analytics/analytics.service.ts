import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface AnalyticsEvent {
  appId: string;
  eventType: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

export interface AnalyticsResponse {
  success: boolean;
  id: string;
}

export interface PerformanceMetrics {
  appStartDuration?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
  memoryUsage?: number;
  connectionType?: string;
  deviceType?: string;
}

interface QueuedEvent {
  id: string;
  payload: AnalyticsEvent;
  retryCount: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private storage = inject(Storage);
  readonly #analyticsEnabled = signal<boolean>(true);
  readonly analyticsEnabled = this.#analyticsEnabled.asReadonly();
  private readonly analyticsEndpoint = `${environment.analyticsEndpoint}events`;
  private readonly analyticsBatchEndpoint = `${environment.analyticsEndpoint}events/batch`;
  private readonly appId = 'lightning-bowl';
  private readonly QUEUE_KEY = 'analytics_queue';
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 50; // Send up to 50 events per batch
  private readonly QUEUE_FLUSH_INTERVAL = 30000; // Flush every 30 seconds
  private readonly BATCH_DEBOUNCE_MS = 5000; // Wait 5 seconds before sending batch (collect more events)
  private readonly MAX_QUEUE_SIZE = 500; // Prevent infinite queue growth
  private processingQueue = false;

  private storageReady = false;
  private batchFlushTimer?: ReturnType<typeof setTimeout>;

  private navigationStartTime?: number;
  private currentRoute?: string;

  constructor() {
    // Initialize queue processing
    void this.initializeQueueProcessing();
  }

  // Only track in production
  private get isProduction(): boolean {
    return environment.production;
  }

  /**
   * Track an analytics event
   * @param eventType - Type of event (e.g., 'game_saved', 'page_view', 'ball_added')
   * @param properties - Optional additional properties for the event
   * @returns Promise with the event ID if successful
   */
  async trackEvent(eventType: string, properties?: Record<string, unknown>): Promise<string | null> {
    // Don't track if analytics is disabled or not in production
    if (!this.#analyticsEnabled() || !this.isProduction || (window as any).env?.GITHUB_BRANCH === 'test') {
      if (!environment.production) {
        console.warn(`[Analytics] Event blocked in dev mode: ${eventType}`);
      }
      return null;
    }

    const payload: AnalyticsEvent = {
      appId: this.appId,
      eventType,
      properties: properties || {},
      timestamp: Date.now(),
    };

    // Queue event - will be sent in next batch (debounced or periodic)
    await this.addToQueue(payload);

    return null;
  }

  /**
   * Track a game being saved
   * @param gameData - Optional game statistics
   */
  async trackGameSaved(gameData?: { score?: number; pins?: number }): Promise<void> {
    await this.trackEvent('game_saved', gameData);
  }

  /**
   * Track a ball being added to arsenal
   */
  async trackBallAdded(ballData?: { brand?: string; name?: string }): Promise<void> {
    await this.trackEvent('ball_added', ballData);
  }

  /**
   * Track pattern lookup
   */
  async trackPatternLookup(patternName?: string): Promise<void> {
    await this.trackEvent('pattern_lookup', { pattern: patternName });
  }

  /**
   * Track app installation (PWA)
   */
  async trackAppInstalled(): Promise<void> {
    await this.trackEvent('app_installed');
  }

  /**
   * Track league creation
   */
  async trackLeagueCreated(leagueData?: { name?: string; gameCount?: number }): Promise<void> {
    await this.trackEvent('league_created', leagueData);
  }

  /**
   * Track league updated
   */
  async trackLeagueEdited(): Promise<void> {
    await this.trackEvent('league_edited');
  }

  /**
   * Track league deleted
   */
  async trackLeagueDeleted(): Promise<void> {
    await this.trackEvent('league_deleted');
  }

  /**
   * Track game edited
   */
  async trackGameEdited(gameData?: { score?: number }): Promise<void> {
    await this.trackEvent('game_edited', gameData);
  }

  /**
   * Track game deleted
   */
  async trackGameDeleted(): Promise<void> {
    await this.trackEvent('game_deleted');
  }

  /**
   * Track theme changed
   */
  async trackThemeChanged(theme: string): Promise<void> {
    await this.trackEvent('theme_changed', { theme });
  }

  /**
   * Track export action
   */
  async trackExport(exportType: 'excel' | 'pdf' | 'csv'): Promise<void> {
    await this.trackEvent('export', { type: exportType });
  }

  /**
   * Track OCR usage
   */
  async trackOCRUsed(success: boolean): Promise<void> {
    await this.trackEvent('ocr_used', { success });
  }

  /**
   * Track alley search
   */
  async trackAlleySearch(query: string): Promise<void> {
    await this.trackEvent('alley_search', { query });
  }

  /**
   * Track ball search
   */
  async trackBallSearch(query: string): Promise<void> {
    await this.trackEvent('ball_search', { query });
  }

  /**
   * Track ball filter applied
   */
  async trackBallFilterApplied(filters: Record<string, unknown>): Promise<void> {
    await this.trackEvent('ball_filter_applied', filters);
  }

  /**
   * Track game filter applied
   */
  async trackGameFilterApplied(filters: Record<string, unknown>): Promise<void> {
    await this.trackEvent('game_filter_applied', filters);
  }

  /**
   * Track app launch with startup performance
   */
  async trackAppLaunched(): Promise<void> {
    // Calculate startup duration from window (set in main.ts)
    let startupDuration: number | undefined;
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appStartTime = (window as any).__APP_STARTUP_TIME__;
      if (appStartTime) {
        startupDuration = performance.now() - appStartTime;
      }
    }

    // Track as performance metric if available
    if (startupDuration) {
      await this.trackPerformanceMetric('app_startup', startupDuration);
    }
  }

  /**
   * Track error occurred
   */
  async trackError(errorType: string, errorMessage?: string): Promise<void> {
    await this.trackEvent('error_occurred', {
      errorType,
      errorMessage: errorMessage?.substring(0, 100), // Limit length
    });
  }

  /**
   * Enable or disable analytics tracking
   * @param enabled - Whether analytics should be enabled
   */
  setAnalyticsEnabled(enabled: boolean): void {
    this.#analyticsEnabled.set(enabled);
  }

  /**
   * Track route/page navigation performance
   * Call this when navigating to a new route
   */
  async trackRouteChange(route: string): Promise<void> {
    const now = Date.now();

    // If we have a previous navigation, calculate the duration
    if (this.navigationStartTime && this.currentRoute) {
      const duration = now - this.navigationStartTime;
      await this.trackEvent('performance_navigation', {
        fromRoute: this.currentRoute,
        toRoute: route,
        duration,
        ...this.getDeviceInfo(),
      });
    }

    // Update for next navigation
    this.currentRoute = route;
    this.navigationStartTime = now;
  }

  /**
   * Initialize queue processing and background sync
   */
  private async initializeQueueProcessing(): Promise<void> {
    // Ensure storage is initialized
    await this.ensureStorageReady();

    // Process queue on app startup
    void this.processQueue();

    // Set up periodic queue processing
    setInterval(() => {
      void this.processQueue();
    }, this.QUEUE_FLUSH_INTERVAL);

    // Process queue when coming back online
    window.addEventListener('online', () => {
      void this.processQueue();
    });

    // Register Background Sync if available (for PWA)
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      void this.registerBackgroundSync();
    }

    // Use Beacon API as fallback for critical events on page unload
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.flushBeforeUnload();
      }
    });
  }

  /**
   * Track performance metric
   */
  private async trackPerformanceMetric(metricName: string, value: number): Promise<void> {
    await this.trackEvent('performance_metric', {
      metric: metricName,
      value: Math.round(value),
      ...this.getDeviceInfo(),
    });
  }

  /**
   * Get device and connection information
   */
  private getDeviceInfo(): Record<string, unknown> {
    const deviceInfo: Record<string, unknown> = {};

    // Device type
    if (typeof window !== 'undefined') {
      deviceInfo['userAgent'] = navigator.userAgent;
      deviceInfo['platform'] = navigator.platform;
      deviceInfo['language'] = navigator.language;
      deviceInfo['screenWidth'] = window.screen.width;
      deviceInfo['screenHeight'] = window.screen.height;
      deviceInfo['devicePixelRatio'] = window.devicePixelRatio;

      // Device type detection
      const ua = navigator.userAgent;
      if (/mobile/i.test(ua)) {
        deviceInfo['deviceType'] = 'mobile';
      } else if (/tablet/i.test(ua)) {
        deviceInfo['deviceType'] = 'tablet';
      } else {
        deviceInfo['deviceType'] = 'desktop';
      }

      // Connection type (if available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = (navigator as any).connection;
      if (connection) {
        deviceInfo['connectionType'] = connection.effectiveType;
        deviceInfo['downlink'] = connection.downlink;
        deviceInfo['rtt'] = connection.rtt;
        deviceInfo['saveData'] = connection.saveData;
      }

      // Memory info (if available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memory = (performance as any).memory;
      if (memory) {
        deviceInfo['memoryUsed'] = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
        deviceInfo['memoryTotal'] = Math.round(memory.totalJSHeapSize / 1024 / 1024); // MB
        deviceInfo['memoryLimit'] = Math.round(memory.jsHeapSizeLimit / 1024 / 1024); // MB
      }
    }

    return deviceInfo;
  }

  /**
   * Ensure storage is ready before use
   */
  private async ensureStorageReady(): Promise<void> {
    if (!this.storageReady) {
      await this.storage.create();
      this.storageReady = true;
    }
  }

  /**
   * Register background sync for offline analytics
   */
  private async registerBackgroundSync(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - Background Sync API types may not be available
      await registration.sync.register('analytics-sync');
    } catch (error) {
      console.warn('Background Sync registration failed:', error);
    }
  }

  /**
   * Flush pending events before page unload using Beacon API
   */
  private async flushBeforeUnload(): Promise<void> {
    if (!navigator.onLine) {
      return; // Queue will be processed when back online
    }

    const queue = await this.getQueue();
    if (queue.length === 0) {
      return;
    }

    // Send all queued events in a single batch using Beacon API
    const events = queue.map((queuedEvent) => queuedEvent.payload);
    const batchRequest = { events };

    try {
      const blob = new Blob([JSON.stringify(batchRequest)], {
        type: 'application/json',
      });

      const sent = navigator.sendBeacon(this.analyticsBatchEndpoint, blob);

      if (sent) {
        // Clear the entire queue if beacon was accepted
        await this.storage.set(this.QUEUE_KEY, []);
      }
    } catch (error) {
      console.warn('Beacon API failed:', error);
      // Queue will be processed on next app launch
    }
  }

  /**
   * Get analytics queue from storage
   */
  private async getQueue(): Promise<QueuedEvent[]> {
    await this.ensureStorageReady();
    const queue = await this.storage.get(this.QUEUE_KEY);
    return queue || [];
  }

  /**
   * Add event to queue
   */
  private async addToQueue(payload: AnalyticsEvent): Promise<void> {
    const queue = await this.getQueue();

    // Prevent queue from growing infinitely
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('Analytics queue is full, discarding oldest events');
      queue.splice(0, 50); // Remove oldest 50 events
    }

    const queuedEvent: QueuedEvent = {
      id: this.generateId(),
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
      retryCount: 0,
      timestamp: Date.now(),
    };
    queue.push(queuedEvent);
    await this.storage.set(this.QUEUE_KEY, queue);

    // Schedule a debounced batch send
    this.scheduleBatchFlush(queue.length);
  }

  /**
   * Schedule a batch flush with debouncing
   * Only sends immediately if queue is at max size, otherwise waits for debounce period
   */
  private scheduleBatchFlush(queueLength: number): void {
    // If queue is at max batch size, send immediately (don't wait for debounce)
    if (queueLength >= this.BATCH_SIZE) {
      if (this.batchFlushTimer) {
        clearTimeout(this.batchFlushTimer);
        this.batchFlushTimer = undefined;
      }
      void this.processQueue();
      return;
    }

    // Otherwise, debounce: clear existing timer and set a new one
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
    }

    this.batchFlushTimer = setTimeout(() => {
      this.batchFlushTimer = undefined;
      void this.processQueue();
    }, this.BATCH_DEBOUNCE_MS);
  }

  /**
   * Process queued analytics events in batches
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || !navigator.onLine) {
      return;
    }

    this.processingQueue = true;

    try {
      const queue = await this.getQueue();

      if (queue.length === 0) {
        return;
      }

      // Process in batches
      const batch = queue.slice(0, this.BATCH_SIZE);
      const events = batch.map((queuedEvent) => queuedEvent.payload);

      try {
        // Send batch
        const response = await firstValueFrom(this.http.post<{ success: boolean; count: number }>(this.analyticsBatchEndpoint, { events }));

        if (response.success) {
          // Remove successfully sent events from queue
          const remainingQueue = queue.slice(batch.length);
          await this.storage.set(this.QUEUE_KEY, remainingQueue);
        } else {
          // Increment retry count for failed batch
          await this.handleFailedBatch(batch);
        }
      } catch (error) {
        console.warn('Failed to send analytics batch:', error);
        await this.handleFailedBatch(batch);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Handle failed batch (retry or remove)
   */
  private async handleFailedBatch(batch: QueuedEvent[]): Promise<void> {
    const queue = await this.getQueue();

    // Increment retry count for events in the failed batch
    batch.forEach((batchEvent) => {
      const eventIndex = queue.findIndex((e) => e.id === batchEvent.id);
      if (eventIndex !== -1) {
        queue[eventIndex].retryCount++;
      }
    });

    // Remove events that exceeded max retries
    const filteredQueue = queue.filter((event) => event.retryCount < this.MAX_RETRIES);
    const removedCount = queue.length - filteredQueue.length;

    if (removedCount > 0) {
      console.warn(`Removed ${removedCount} analytics events after ${this.MAX_RETRIES} failed attempts`);
    }

    await this.storage.set(this.QUEUE_KEY, filteredQueue);
  }

  /**
   * Generate unique ID for queued events
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
