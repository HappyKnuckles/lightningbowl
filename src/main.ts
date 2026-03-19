import { importProvidersFrom, isDevMode } from '@angular/core';
import { environment } from './environments/environment';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular';
import { AppComponent } from './app/app.component';
import { provideServiceWorker } from '@angular/service-worker';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { routes } from './app/app.routes';
import { StorageService } from './app/core/services/storage/storage.service';
import { CloudSyncService } from './app/core/services/cloud-sync/cloud-sync.service';

if (environment.production) {
  // Track app start time
  const appStartTime = performance.now();

  if (typeof window !== 'undefined') {
    (window as any).__APP_STARTUP_TIME__ = appStartTime;
  }
  injectSpeedInsights();
  inject();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(BrowserModule, IonicStorageModule.forRoot()),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideAnimationsAsync(),
    provideIonicAngular({ innerHTMLTemplatesEnabled: true }),
    provideHttpClient(withInterceptorsFromDi()),
    StorageService,
    CloudSyncService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((err) => console.error(err));
