import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { RangeCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonModal,
  IonNote,
  IonProgressBar,
  IonRange,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, folderOpenOutline, refreshOutline, sparklesOutline, videocamOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Pattern } from 'src/app/core/models/pattern.model';
import { Handedness, NormalizedPoint, ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { MAX_SHOT_VIDEO_BYTES, ShotAnalysisService } from 'src/app/core/services/shot-analysis/shot-analysis.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { patternRatioColor, withPatternRows } from 'src/app/core/utils/shot-analysis-utils/pattern-overlay.utils';
import {
  buildCalibration,
  CALIBRATION_STEPS,
  loupeSourceRect,
  normalizePoint,
  shotMetricRows,
  validateCalibration,
} from 'src/app/core/utils/shot-analysis-utils/shot-analysis.utils';
import {
  clampTrimWindow,
  defaultTrimWindow,
  isTrimmed,
  MAX_SHOT_WINDOW_S,
  trimVideo,
  TrimWindow,
} from 'src/app/core/utils/shot-analysis-utils/video-trim.utils';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { ShotLaneComponent } from 'src/app/shared/components/shot-lane/shot-lane.component';

type Step = 'pick' | 'calibrate' | 'analyzing' | 'result';

const HANDEDNESS_STORAGE_KEY = 'shot-analysis-handedness';
/** URL of the last pattern picked, so the next shot starts on the same lane conditions. */
const PATTERN_STORAGE_KEY = 'shot-analysis-pattern';
/** Touch tolerance around a placed corner, in screen pixels. */
const HIT_RADIUS_PX = 28;
/** Part of the frame width the magnifier shows. */
const LOUPE_FRACTION = 0.07;
const LOUPE_CSS_PX = 112;

/**
 * Video shot analysis: record or pick a video, mark the lane corners on one frame,
 * send it to the ball tracker, and show the path and metrics LaneTrax-style.
 */
@Component({
  selector: 'app-shot-analysis',
  templateUrl: './shot-analysis.page.html',
  styleUrls: ['./shot-analysis.page.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonMenuButton,
    IonModal,
    IonNote,
    IonProgressBar,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonTitle,
    IonToolbar,
    GenericTypeaheadComponent,
    ShotLaneComponent,
  ],
})
export class ShotAnalysisPage implements OnDestroy {
  readonly #analysisService = inject(ShotAnalysisService);
  readonly #toastService = inject(ToastService);
  readonly #patternService = inject(PatternService);
  readonly patternsStore = inject(PatternsStore);
  readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly overlay = viewChild<ElementRef<SVGSVGElement>>('overlay');
  readonly loupeCanvas = viewChild<ElementRef<HTMLCanvasElement>>('loupe');
  /** Pattern the shot was bowled on, with its oil data; optional. */
  readonly pattern = signal<Pattern | null>(null);
  readonly patternTitles = computed(() => (this.pattern() ? [this.pattern()!.title] : []));

  readonly patternTitle = computed(() => this.pattern()?.title ?? 'No pattern');
  readonly patternDetail = computed(() => {
    const pattern = this.pattern();
    if (!pattern) {
      return 'Pick the pattern to see the oil';
    }
    return [pattern.distance, pattern.ratio, pattern.volume ? `${pattern.volume} mL` : undefined].filter(Boolean).join(' · ');
  });
  readonly patternColor = computed(() => {
    const pattern = this.pattern();
    return pattern ? patternRatioColor(pattern.ratio) : null;
  });
  readonly points = signal<NormalizedPoint[]>([]);

  readonly instruction = computed(() => CALIBRATION_STEPS[this.points().length]?.label ?? 'Lane marked. Drag a corner to adjust it.');
  readonly calibrationError = computed(() => validateCalibration(this.points()));
  readonly canAnalyze = computed(() => this.points().length === CALIBRATION_STEPS.length && this.calibrationError() === null);
  readonly frameSize = signal<{ height: number; width: number } | null>(null);
  readonly viewBox = computed(() => {
    const size = this.frameSize();
    return size ? `0 0 ${size.width} ${size.height}` : '0 0 1 1';
  });
  readonly markerRadius = computed(() => (this.frameSize()?.width ?? 1000) * 0.012);
  readonly overlayPoints = computed(() => {
    const size = this.frameSize();
    if (!size) {
      return [];
    }
    return this.points().map((p, i) => ({ index: i, x: p[0] * size.width, y: p[1] * size.height, label: CALIBRATION_STEPS[i].short }));
  });
  /** Lane outline through the corners placed so far: foul line, then the edges, then the pin end. */
  readonly outline = computed(() => {
    const p = this.overlayPoints();
    const segments: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ];
    return segments.filter(([a, b]) => p[a] && p[b]).map(([a, b]) => ({ key: `${a}-${b}`, x1: p[a].x, y1: p[a].y, x2: p[b].x, y2: p[b].y }));
  });
  readonly uploadProgress = signal(0);
  readonly uploadPercent = computed(() => Math.round(this.uploadProgress() * 100));
  readonly result = signal<ShotAnalysisResult | null>(null);
  readonly trackedRange = computed(() => {
    const result = this.result();
    return result ? `Tracked from ${Math.round(result.trackedFromFt)} to ${Math.round(result.trackedToFt)} ft` : '';
  });

  readonly metricRows = computed(() => {
    const result = this.result();
    if (!result) {
      return [];
    }
    const rows = shotMetricRows(result);
    const pattern = this.pattern();
    return pattern ? withPatternRows(rows, result, pattern) : rows;
  });
  /** Part of the video that is sent and analysed; the corners are marked on a frame inside it. */
  readonly trimWindow = signal<TrimWindow>({ startS: 0, endS: 0 });

  readonly trimValue = computed(() => ({ lower: this.trimWindow().startS, upper: this.trimWindow().endS }));
  readonly trimLabel = computed(() => {
    const { startS, endS } = this.trimWindow();
    return `${startS.toFixed(1)}–${endS.toFixed(1)} s (${(endS - startS).toFixed(1)} s)`;
  });
  readonly step = signal<Step>('pick');
  readonly videoUrl = signal<string | null>(null);
  readonly duration = signal(0);
  readonly frameTime = signal(0);
  /** Cutting the selected part out of the video before the upload. */
  readonly preparing = signal(false);
  readonly handedness = signal<Handedness>(loadHandedness());
  readonly processing = signal(false);
  readonly loupeVisible = signal(false);
  /** The magnifier sits in the corner away from the finger. */
  readonly loupeOnRight = signal(false);
  readonly patternTypeaheadConfig: TypeaheadConfig<Partial<Pattern>> = {
    ...inject(TypeaheadConfigService).partialPattern,
    title: 'Select Pattern',
    maxSelections: 1,
  };
  readonly maxWindowS = MAX_SHOT_WINDOW_S;
  readonly totalSteps = CALIBRATION_STEPS.length;
  readonly loupeCssPx = LOUPE_CSS_PX;

  #file: File | null = null;
  /** Bumped by every analysis start and cancel, so a cut finishing late is dropped. */
  #run = 0;
  #subscription: Subscription | null = null;
  #dragIndex: number | null = null;

  constructor() {
    addIcons({ videocamOutline, folderOpenOutline, arrowUndoOutline, refreshOutline, sparklesOutline });
    const url = loadPatternUrl();
    if (url) {
      void this.#loadPattern(url);
    }
  }

  ngOnDestroy(): void {
    this.#subscription?.unsubscribe();
    this.#setVideo(null);
  }

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    // no size check here: a long video may well fit once trimmed to the shot (checked before the upload)
    this.#setVideo(file);
    this.step.set('calibrate');
  }

  onMetadataLoaded(): void {
    const video = this.video()?.nativeElement;
    if (!video) {
      return;
    }
    this.frameSize.set({ width: video.videoWidth, height: video.videoHeight });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    this.duration.set(duration);
    if (this.points().length === 0) {
      this.trimWindow.set(defaultTrimWindow(duration));
    }
    // Seeking renders a frame on iOS, which shows nothing for a paused video otherwise. Coming back to
    // marking (e.g. after a failed analysis) returns to the frame the corners were placed on.
    const time = this.points().length > 0 ? this.frameTime() : Math.min(this.trimWindow().startS + 0.05, duration);
    video.currentTime = time;
    this.frameTime.set(time);
  }

  onVideoError(): void {
    this.#toastService.showToast(TOAST_MESSAGES.shotAnalysisVideoError, 'bug', true);
    this.startOver();
  }

  onScrub(event: RangeCustomEvent): void {
    const video = this.video()?.nativeElement;
    const value = event.detail.value;
    if (!video || typeof value !== 'number') {
      return;
    }
    video.currentTime = value;
    this.frameTime.set(value);
  }

  /** Dragging a trim knob shows that frame, so the shot's start and end can be found; marking then happens on it. */
  onTrim(event: RangeCustomEvent): void {
    const value = event.detail.value;
    const video = this.video()?.nativeElement;
    if (typeof value !== 'object' || !video) {
      return;
    }
    const previous = this.trimWindow();
    const next = clampTrimWindow({ startS: value.lower, endS: value.upper }, previous, this.duration());
    this.trimWindow.set(next);
    const time = next.startS !== previous.startS ? next.startS : next.endS;
    video.currentTime = time;
    this.frameTime.set(time);
  }

  async onPatternSelected(titles: string[]): Promise<void> {
    const title = titles[0];
    const url = title ? this.patternsStore.allPatterns().find((p) => p.title === title)?.url : undefined;
    if (!url) {
      this.pattern.set(null);
      savePatternUrl(null);
      return;
    }
    await this.#loadPattern(url);
  }

  setHandedness(value: Handedness): void {
    this.handedness.set(value);
    try {
      localStorage.setItem(HANDEDNESS_STORAGE_KEY, value);
    } catch {
      // storage unavailable; the choice still applies to this session
    }
  }

  onPointerDown(event: PointerEvent): void {
    const point = this.#toFramePoint(event);
    if (!point) {
      return;
    }
    // While placing, every tap is the next corner: at the pins the lane is only a few screen pixels
    // wide, so "grab the corner near the finger" would grab the previous corner instead. Once all
    // corners are placed, a touch drags the nearest one; the new corner can be dragged while placing.
    if (this.points().length < CALIBRATION_STEPS.length) {
      this.#dragIndex = this.points().length;
      this.points.update((points) => [...points, point.normalized]);
    } else {
      const existing = this.#nearestPoint(point.x, point.y);
      if (existing === null) {
        return;
      }
      this.#dragIndex = existing;
    }
    try {
      // keep receiving moves when the finger leaves the overlay while dragging
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // not an active pointer (synthetic events); dragging still works inside the overlay
    }
    this.#showLoupe(point.x, point.y, event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.#dragIndex === null) {
      return;
    }
    const point = this.#toFramePoint(event);
    if (!point) {
      return;
    }
    const index = this.#dragIndex;
    this.points.update((points) => points.map((p, i) => (i === index ? point.normalized : p)));
    this.#showLoupe(point.x, point.y, event);
  }

  onPointerUp(): void {
    this.#dragIndex = null;
    this.loupeVisible.set(false);
  }

  undoPoint(): void {
    this.points.update((points) => points.slice(0, -1));
  }

  resetPoints(): void {
    this.points.set([]);
  }

  async analyze(): Promise<void> {
    const calibration = buildCalibration(this.points(), this.frameTime());
    const file = this.#file;
    if (!calibration || !file || !this.canAnalyze()) {
      return;
    }
    this.video()?.nativeElement.pause();
    this.uploadProgress.set(0);
    this.processing.set(false);
    this.step.set('analyzing');
    this.#subscription?.unsubscribe();
    this.#subscription = null;

    const run = ++this.#run;
    const upload = await this.#prepareUpload(file, calibration);
    // cancelled, or another video picked, while cutting
    if (run !== this.#run || this.step() !== 'analyzing') {
      return;
    }
    if (upload.video.size > MAX_SHOT_VIDEO_BYTES) {
      this.#toastService.showToast(TOAST_MESSAGES.shotAnalysisVideoTooLarge, 'bug', true);
      this.step.set('calibrate');
      return;
    }

    this.#subscription = this.#analysisService
      .analyze(upload.video, upload.fileName, upload.calibration, { handedness: this.handedness() })
      .subscribe({
        next: (event) => {
          if (event.type === 'uploading') {
            this.uploadProgress.set(event.progress);
          } else if (event.type === 'processing') {
            this.processing.set(true);
          } else {
            this.result.set(event.result);
            this.step.set('result');
          }
        },
        error: (error: Error) => {
          this.#toastService.showToast(error.message, 'bug', true);
          this.step.set('calibrate');
        },
      });
  }

  cancelAnalysis(): void {
    this.#run++;
    this.preparing.set(false);
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.step.set('calibrate');
  }

  /** Same video, marked again (e.g. when the corners were off). */
  remark(): void {
    this.result.set(null);
    this.step.set('calibrate');
  }

  startOver(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#setVideo(null);
    this.result.set(null);
    this.step.set('pick');
  }

  /**
   * What gets uploaded: the selected part cut out of the video, so less has to be sent, or the whole
   * file when the cut fails or isn't smaller. The cut starts slightly before the selection (at a key
   * frame), so the calibration frame time is shifted to the cut file's time.
   */
  async #prepareUpload(file: File, calibration: ShotCalibration): Promise<{ calibration: ShotCalibration; fileName: string; video: Blob }> {
    const window = this.trimWindow();
    if (!isTrimmed(window, this.duration())) {
      return { video: file, fileName: file.name, calibration };
    }

    this.preparing.set(true);
    try {
      const cut = await trimVideo(file, window);
      if (cut && cut.blob.size < file.size) {
        return {
          video: cut.blob,
          fileName: file.name.replace(/\.[^.]+$/, '') + '-shot.mp4',
          calibration: { ...calibration, frameTimeS: Math.max(0, calibration.frameTimeS - cut.offsetS) },
        };
      }
    } finally {
      this.preparing.set(false);
    }
    return { video: file, fileName: file.name, calibration };
  }

  #setVideo(file: File | null): void {
    const previous = this.videoUrl();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.#file = file;
    this.videoUrl.set(file ? URL.createObjectURL(file) : null);
    this.frameSize.set(null);
    this.duration.set(0);
    this.frameTime.set(0);
    this.trimWindow.set({ startS: 0, endS: 0 });
    this.points.set([]);
  }

  /** The pointer position in video pixels (the overlay's viewBox), or null outside the frame. */
  #toFramePoint(event: PointerEvent): { normalized: NormalizedPoint; x: number; y: number } | null {
    const svg = this.overlay()?.nativeElement;
    const size = this.frameSize();
    const matrix = svg?.getScreenCTM();
    if (!svg || !size || !matrix) {
      return null;
    }
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const normalized = normalizePoint(local.x, local.y, size.width, size.height);
    return normalized ? { x: local.x, y: local.y, normalized } : null;
  }

  #nearestPoint(x: number, y: number): number | null {
    const scale = this.overlay()?.nativeElement.getScreenCTM()?.a ?? 1;
    const tolerance = HIT_RADIUS_PX / scale;
    let best: number | null = null;
    let bestDistance = tolerance;
    for (const p of this.overlayPoints()) {
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance <= bestDistance) {
        best = p.index;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Draws the frame around the finger, magnified, so a corner can be placed precisely. */
  #showLoupe(x: number, y: number, event: PointerEvent): void {
    const video = this.video()?.nativeElement;
    const canvas = this.loupeCanvas()?.nativeElement;
    const size = this.frameSize();
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !size || !ctx) {
      return;
    }
    const box = (event.currentTarget as Element | null)?.getBoundingClientRect();
    if (box) {
      this.loupeOnRight.set(event.clientX < box.left + box.width / 2);
    }
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(LOUPE_CSS_PX * dpr);
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    const src = loupeSourceRect(x, y, size.width, size.height, size.width * LOUPE_FRACTION);
    ctx.drawImage(video, src.x, src.y, src.size, src.size, 0, 0, px, px);
    // crosshair at the finger's position inside the (possibly clamped) source square
    const cx = ((x - src.x) / src.size) * px;
    const cy = ((y - src.y) / src.size) * px;
    ctx.strokeStyle = '#ff2d55';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(cx - px * 0.15, cy);
    ctx.lineTo(cx + px * 0.15, cy);
    ctx.moveTo(cx, cy - px * 0.15);
    ctx.lineTo(cx, cy + px * 0.15);
    ctx.stroke();
    this.loupeVisible.set(true);
  }

  /** The search results carry no oil data, so the full pattern is fetched (and remembered) on selection. */
  async #loadPattern(url: string): Promise<void> {
    const pattern = await this.#patternService.getPatternData(url);
    if (pattern?.url && pattern.forwards_data) {
      this.pattern.set(pattern);
      savePatternUrl(pattern.url);
    }
  }
}

function loadPatternUrl(): string | null {
  try {
    return localStorage.getItem(PATTERN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePatternUrl(url: string | null): void {
  try {
    if (url) {
      localStorage.setItem(PATTERN_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(PATTERN_STORAGE_KEY);
    }
  } catch {
    // storage unavailable; the pattern still applies to this session
  }
}

function loadHandedness(): Handedness {
  try {
    return localStorage.getItem(HANDEDNESS_STORAGE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}
