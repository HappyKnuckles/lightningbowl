import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';

describe('NetworkService', () => {
  let service: NetworkService;

  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return online status', () => {
    expect(service.isOnline).toBe(true);
    expect(service.isOffline).toBe(false);
  });

  it('should update status when navigator.onLine changes', () => {
    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    // Trigger offline event
    const event = new Event('offline');
    window.dispatchEvent(event);

    // Give the service time to update
    setTimeout(() => {
      expect(service.isOnline).toBe(false);
      expect(service.isOffline).toBe(true);
    }, 10);
  });
});
