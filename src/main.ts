import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { importProvidersFrom, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';
import { inject as injectVercelAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { CloudSyncService } from './app/core/services/cloud-sync/cloud-sync.service';
import { AppFacade } from './app/core/stores/app.facade';
import { environment } from './environments/environment';
declare global {
  interface Window {
    __APP_STARTUP_TIME__?: number;
  }
}
if (environment.production) {
  // Track app start time
  const appStartTime = performance.now();

  if (typeof window !== 'undefined') {
    window.__APP_STARTUP_TIME__ = appStartTime;
  }
  injectSpeedInsights();
  injectVercelAnalytics();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(BrowserModule, IonicStorageModule.forRoot()),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideAnimationsAsync(),
    provideIonicAngular({ innerHTMLTemplatesEnabled: true }),
    provideHttpClient(withInterceptorsFromDi()),
    provideAppInitializer(() => {
      void inject(AppFacade)
        .init()
        .catch((error) => console.error('AppFacade initialization failed:', error));
    }),
    provideAppInitializer(() => {
      void inject(CloudSyncService)
        .init()
        .catch((error) => console.error('CloudSyncService initialization failed:', error));
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((err) => console.error(err));
