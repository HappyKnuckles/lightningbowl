import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { importProvidersFrom } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { IonicStorageModule } from '@ionic/storage-angular';

/**
 * Providers applied to every TestBed by the `unit-test` builder (`providersFile`
 * in angular.json). These are the app-wide providers that main.ts sets up — specs
 * exercise components that reach them transitively (stores -> StorageRepository ->
 * Storage, services -> HttpClient, Ionic overlays -> AngularDelegate), so wiring
 * them once here keeps individual specs free of boilerplate.
 *
 * HttpClient is backed by the testing backend, so no spec can make a real request.
 */
export default [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideIonicAngular(),
  provideNoopAnimations(),
  provideRouter([]),
  importProvidersFrom(IonicStorageModule.forRoot()),
];
