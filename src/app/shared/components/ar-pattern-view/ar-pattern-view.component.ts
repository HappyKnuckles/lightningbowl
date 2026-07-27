import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, closeOutline, locateOutline, refreshOutline } from 'ionicons/icons';
import { Pattern } from 'src/app/core/models/pattern.model';
import { ArQuickLookService } from 'src/app/core/services/ar-quick-look/ar-quick-look.service';
import { AR_BACKEND_PROVIDER } from 'src/app/core/services/ar-session/ar-backend.provider';
import { ArSessionService } from 'src/app/core/services/ar-session/ar-session.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { ArLaneCalibratorComponent } from '../ar-lane-calibrator/ar-lane-calibrator.component';
import { ArPatternHudComponent } from '../ar-pattern-hud/ar-pattern-hud.component';
import { PatternCanvasComponent } from '../pattern-canvas/pattern-canvas.component';

/**
 * Projects an oil pattern onto a real lane.
 *
 * Not a page and not a modal: it is a bare overlay the pattern it shows drops
 * onto the screen, and the session opens the moment it appears — the tap on
 * "view in AR" is the only step, and it is also the user gesture WebXR needs.
 *
 * The camera view is rendered by the AR layer behind a transparent webview, so
 * everything here is ordinary Ionic markup floating on top of it.
 */
@Component({
  selector: 'app-ar-pattern-view',
  templateUrl: './ar-pattern-view.component.html',
  styleUrl: './ar-pattern-view.component.scss',
  providers: [AR_BACKEND_PROVIDER, ArSessionService],
  imports: [IonButton, IonIcon, ArLaneCalibratorComponent, ArPatternHudComponent, PatternCanvasComponent],
})
export class ArPatternViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly patternService = inject(PatternService);
  private readonly patternsStore = inject(PatternsStore);
  private readonly quickLook = inject(ArQuickLookService);
  readonly session = inject(ArSessionService);

  /** The pattern to project. AR opens straight onto it. */
  readonly pattern = input.required<Pattern>();
  readonly closed = output<void>();

  /** iOS shows the pattern through AR Quick Look instead of a WebXR session. */
  readonly quickLookUrl = signal<string | null>(null);
  readonly quickLookSupported = this.quickLook.isSupported();

  /** Stripped list, feeding the in-session picker in the HUD. */
  readonly patterns = this.patternsStore.allPatterns;

  readonly phase = this.session.phase;
  /** What the session is showing — the input pattern until one is swapped in. */
  readonly activePattern = this.session.pattern;
  readonly message = this.session.message;

  readonly isCalibrating = computed(() => this.phase() === 'calibrating');
  readonly isScanning = computed(() => this.phase() === 'scanning');
  readonly isUnsupported = computed(() => this.phase() === 'unsupported');
  readonly isLive = computed(() => this.phase() === 'tracking' || this.phase() === 'limited');
  /** True only while a session owns the screen, so the camera shows through. */
  readonly isSessionLive = computed(() => this.isScanning() || this.isCalibrating() || this.isLive());
  /** The only states with something to read — and the only opaque ones. */
  readonly showsNotice = computed(() => this.isUnsupported() || this.phase() === 'failed');

  /**
   * What the view can see about its own environment.
   *
   * iOS Safari cannot be inspected without a Mac, so it reports the facts that
   * decide which branch it takes rather than hiding them in a console nobody
   * can reach.
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

  /** Handed to WebXR as the DOM overlay root. */
  private readonly host = viewChild<ElementRef<HTMLElement>>('arRoot');

  constructor() {
    addIcons({ arrowUndoOutline, closeOutline, locateOutline, refreshOutline });
  }

  /**
   * Moves this view out to the body.
   *
   * It is declared inside the pattern page, but the pattern detail it is opened
   * from is an Ionic modal — and a modal paints above everything the page can
   * draw, however high its z-index, because the page is its own stacking
   * context. Rehoming the element is what lets the detail stay open underneath
   * instead of having to be closed first. Angular keeps rendering it from here.
   */
  ngOnInit(): void {
    document.body.appendChild(this.elementRef.nativeElement);
  }

  /**
   * Starts as soon as the view exists.
   *
   * After view init rather than on init because the overlay root has to be in
   * the DOM to hand to WebXR — and this still runs inside the activation window
   * of the tap that put this view on screen, which is what WebXR requires.
   */
  ngAfterViewInit(): void {
    void this.enterAr();
  }

  // The USDZ URL is deliberately not revoked here: Quick Look is still loading
  // it as this view goes away. buildUrl revokes the previous one, so at most
  // one archive is ever held.
  ngOnDestroy(): void {
    void this.session.stop();
    // Taken out by hand because it no longer sits where Angular put it.
    this.elementRef.nativeElement.remove();
  }

  async enterAr(): Promise<void> {
    await this.session.start(this.pattern(), this.host()?.nativeElement ?? null);

    // Where no session can run, iOS still has Quick Look — and it opens on its
    // own, so the tap that got here is the only one needed.
    if (this.isUnsupported() && (await this.openQuickLook())) {
      this.close();
      return;
    }

    // The HUD's picker reads the whole library. It is a convenience on top of a
    // running session, so it loads after the camera rather than delaying it.
    if (this.patterns().length === 0) {
      await this.patternsStore.loadAllPatterns();
    }
  }

  async retry(): Promise<void> {
    await this.session.stop();
    await this.enterAr();
  }

  close(): void {
    this.closed.emit();
  }

  async onCalibrationTap(event: { x: number; y: number; index: number }): Promise<void> {
    await this.session.recordTap(event.x, event.y, event.index);
  }

  /** Swaps the projected pattern from the HUD picker, keeping the anchor. */
  async onPatternSelected(url: string): Promise<void> {
    const pattern = await this.patternService.getPatternData(url);
    if (pattern?.url) {
      await this.session.setPattern(pattern);
    }
  }

  /** Enters Quick Look. False when it is unavailable or the build failed. */
  private async openQuickLook(): Promise<boolean> {
    try {
      this.quickLookUrl.set(await this.quickLook.open(this.pattern()));
    } catch {
      this.quickLookUrl.set(null);
    }

    return this.quickLookUrl() !== null;
  }
}
