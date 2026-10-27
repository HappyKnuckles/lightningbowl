import { Provider, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AR_BACKEND, ArBackend } from './ar-backend';
import { NativeArBackend } from './backends/native-ar.backend';
import { WebXrArBackend } from './backends/webxr-ar.backend';

/**
 * Picks the AR runtime for this platform.
 *
 * Native in the app, because it is the only path that works on iPhone and the
 * best tracking on Android. WebXR everywhere else — that is the PWA path, and
 * it drives ARCore through Chrome on Android.
 *
 * Where WebXR is missing (Safari on iPhone has no immersive-ar session mode)
 * the WebXR backend reports itself unsupported with a reason the UI shows, and
 * the page falls back to the flat pattern view. No separate no-op backend is
 * needed in the selection — being honest about support is the backend's job.
 */
export function selectArBackend(): ArBackend {
  const native = inject(NativeArBackend);
  const webxr = inject(WebXrArBackend);

  return Capacitor.isNativePlatform() ? native : webxr;
}

export const AR_BACKEND_PROVIDER: Provider = {
  provide: AR_BACKEND,
  useFactory: selectArBackend,
};
