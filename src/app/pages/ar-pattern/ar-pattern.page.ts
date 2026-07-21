import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, checkmarkOutline, locateOutline, refreshOutline, scanOutline } from 'ionicons/icons';
import { ArQuickLookService } from 'src/app/core/services/ar-quick-look/ar-quick-look.service';
import { ArSessionService } from 'src/app/core/services/ar-session/ar-session.service';
import { AR_BACKEND_PROVIDER } from 'src/app/core/services/ar-session/ar-backend.provider';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { Pattern } from 'src/app/core/models/pattern.model';
import { ArLaneCalibratorComponent } from 'src/app/shared/components/ar-lane-calibrator/ar-lane-calibrator.component';
import { ArPatternHudComponent } from 'src/app/shared/components/ar-pattern-hud/ar-pattern-hud.component';
import { PatternTextureService } from 'src/app/core/services/pattern-texture/pattern-texture.service';
import { PatternCanvasComponent } from 'src/app/shared/components/pattern-canvas/pattern-canvas.component';
import { environment } from 'src/environments/environment';

/**
 * Projects an oil pattern onto a real lane.
 *
 * The camera view is rendered by the native AR layer behind a transparent
 * webview, so everything here is ordinary Ionic markup floating on top of it.
 */
@Component({
  selector: 'app-ar-pattern',
  templateUrl: './ar-pattern.page.html',
  styleUrl: './ar-pattern.page.scss',
  providers: [AR_BACKEND_PROVIDER, ArSessionService],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    ArLaneCalibratorComponent,
    ArPatternHudComponent,
    PatternCanvasComponent,
  ],
})
export class ArPatternPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly patternService = inject(PatternService);
  private readonly patternsStore = inject(PatternsStore);
  private readonly quickLook = inject(ArQuickLookService);
  private readonly patternTextureService = inject(PatternTextureService);
  readonly session = inject(ArSessionService);

  /** iOS shows the pattern through AR Quick Look instead of a WebXR session. */
  readonly quickLookUrl = signal<string | null>(null);
  readonly quickLookPreview = signal<string | null>(null);
  readonly quickLookSupported = this.quickLook.isSupported();
  readonly imagesUrl = environment.imagesUrl;

  /** Stripped list for the picker; full load data is fetched on selection. */
  readonly patterns = this.patternsStore.allPatterns;
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly phase = this.session.phase;
  readonly pattern = this.session.pattern;
  readonly message = this.session.message;

  readonly isCalibrating = computed(() => this.phase() === 'calibrating');
  readonly isScanning = computed(() => this.phase() === 'scanning');
  readonly isUnsupported = computed(() => this.phase() === 'unsupported');
  readonly isLive = computed(() => this.phase() === 'tracking' || this.phase() === 'limited');
  /** Supported and loaded, waiting for the tap that opens the session. */
  readonly isReady = computed(() => this.phase() === 'idle' && this.pattern() !== null);
  /** True only while a session owns the screen, so the camera shows through. */
  readonly isSessionLive = computed(() => this.isScanning() || this.isCalibrating() || this.isLive());

  /**
   * What the page can see about its own environment.
   *
   * iOS Safari cannot be inspected without a Mac, so the page reports the
   * facts that decide which branch it takes rather than hiding them in a
   * console nobody can reach.
   */
  readonly diagnostics = computed(() => {
    const xr = 'xr' in navigator ? 'yes' : 'no';
    const usdz = this.quickLookUrl() ? `${Math.round(this.quickLook.lastSize / 1024)}kb` : 'none';
    return [
      `backend: ${this.session.backendKind}`,
      `phase: ${this.phase()}`,
      `secure: ${window.isSecureContext ? 'yes' : 'no'}`,
      `navigator.xr: ${xr}`,
      `rel=ar: ${this.quickLookSupported ? 'yes' : 'no'}`,
      `usdz: ${usdz}`,
      `patterns: ${this.patterns().length}`,
    ].join(' · ');
  });

  // `read: ElementRef` because the ref is on <ion-content>, which would
  // otherwise resolve to the Ionic component rather than the DOM element
  // WebXR needs as its overlay root.
  private readonly host = viewChild('arRoot', { read: ElementRef<HTMLElement> });

  constructor() {
    addIcons({ locateOutline, arrowUndoOutline, checkmarkOutline, refreshOutline, scanOutline });
    void this.load();
  }

  ngOnDestroy(): void {
    void this.session.stop();
    this.quickLook.revoke();
  }

  /**
   * Builds the USDZ up front so the AR link is a plain tap.
   *
   * Quick Look only opens from a real navigation, so the href has to be there
   * before the user touches it — building on click would be too late.
   */
  private async prepareQuickLook(pattern: Pattern): Promise<void> {
    if (!this.quickLookSupported) {
      return;
    }

    try {
      this.quickLookPreview.set(this.patternTextureService.bakePreview(pattern));
      this.quickLookUrl.set(await this.quickLook.buildUrl(pattern));
    } catch {
      this.quickLookUrl.set(null);
    }
  }

  /**
   * Opens the session. Bound to a tap because WebXR needs user activation —
   * and because tying the camera prompt to an explicit action is the right
   * behaviour anyway.
   */
  async enterAr(): Promise<void> {
    const pattern = this.pattern();
    if (!pattern) {
      return;
    }

    await this.session.start(pattern, this.host()?.nativeElement ?? null);
  }

  async onCalibrationTap(event: { x: number; y: number; index: number }): Promise<void> {
    await this.session.recordTap(event.x, event.y, event.index);
  }

  async onPatternSelected(url: string): Promise<void> {
    const pattern = await this.patternService.getPatternData(url);
    if (pattern?.url) {
      await this.session.setPattern(pattern);
    }
  }

  async retry(): Promise<void> {
    await this.session.stop();
    await this.enterAr();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      // Reached straight from the More tab the store may never have been
      // filled, which is what left this page with nothing to show at all.
      if (this.patterns().length === 0) {
        await this.patternsStore.loadAllPatterns();
      }

      const requested = this.route.snapshot.queryParamMap.get('pattern') ?? this.patterns()[0]?.url;
      if (!requested) {
        this.loadError.set('No patterns are available yet. Open the Pattern Library once while online, then come back.');
        return;
      }

      // getPatternData resolves to an empty object rather than throwing, so a
      // missing url is how a failed fetch shows up here.
      const pattern = await this.patternService.getPatternData(requested);
      if (!pattern?.url) {
        this.loadError.set('Could not load that pattern. Check your connection and try again.');
        return;
      }

      await this.session.prepare(pattern);
      await this.prepareQuickLook(pattern);
    } catch {
      this.loadError.set('Could not load that pattern. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
