import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Observable } from 'rxjs'; // Import `of` to create observables
import { AppComponent } from './app.component';

const mockSwUpdate = {
  isEnabled: false,
  available: new Observable((subscriber: { next: (arg0: { current: string; available: string }) => void; complete: () => void }) => {
    subscriber.next({ current: '1.0.0', available: '1.1.0' });
    subscriber.complete();
  }),
  subscribe: (callback: (value: unknown) => void) => {
    mockSwUpdate.available.subscribe(callback);
  },
};

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [AppComponent],
      providers: [{ provide: SwUpdate, useValue: mockSwUpdate }, provideHttpClient(withInterceptorsFromDi())],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
