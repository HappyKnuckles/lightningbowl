import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { Component, computed, effect, ElementRef, inject, model, OnDestroy, signal, ViewChild, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonImg,
  IonModal,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonMenuButton,
  IonToolbar,
} from '@ionic/angular/standalone';
import type { Chart } from 'chart.js';
import { addIcons } from 'ionicons';
import { add, chevronDownOutline, closeOutline, scaleOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';

interface SavedEntry {
  id: string;
  weight: string;
}

@Component({
  selector: 'app-ball-comparison',
  templateUrl: './ball-comparison.page.html',
  styleUrls: ['./ball-comparison.page.scss'],
  providers: [ModalController],
  standalone: true,
  imports: [
    BallImagePipe,
    IonCol,
    IonRow,
    IonGrid,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonMenuButton,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonModal,
    IonText,
    IonImg,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonCardTitle,
    IonCardSubtitle,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonSegmentView,
    IonSegmentContent,
    GenericTypeaheadComponent,
    IonSelect,
    IonSelectOption,
  ],
})
export class BallComparisonPage implements OnDestroy, OnInit {
  protected readonly ballsStore = inject(BallsStore);
  /** Picker list: the current selection (which may come from a search), then your arsenal and favorites. */
  protected readonly pickerBalls = computed(() => {
    const selectedKeys = new Set(this.selectedBalls().map((b) => `${b.ball_id}-${b.core_weight}`));
    return [...this.selectedBalls(), ...this.ballsStore.myBalls().filter((b) => !selectedKeys.has(`${b.ball_id}-${b.core_weight}`))];
  });
  private readonly ballService = inject(BallService);
  private readonly chartGenerationService = inject(ChartGenerationService);
  private readonly toastService = inject(ToastService);
  private readonly typeaheadConfigService = inject(TypeaheadConfigService);

  @ViewChild('addBallModal', { static: false }) addBallModal!: IonModal;
  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('distChartCanvas', { static: false }) distChartCanvas?: ElementRef;

  readonly selectedBalls = signal<Ball[]>([]);
  readonly selectedSegment = model<'compare' | 'chart'>('compare');
  readonly loadingWeightBallIds = signal<Set<string>>(new Set());

  presentingElement!: HTMLElement | null;

  readonly maxBalls = 6;
  ballTypeaheadConfig: TypeaheadConfig<Ball> = {
    ...this.typeaheadConfigService.ball,
    title: 'Select Balls to Compare',
    maxSelections: this.maxBalls,
  };
  readonly selectedBallIds = computed(() => this.selectedBalls().map((b) => b.ball_id));
  readonly availableWeights = ['12', '13', '14', '15', '16'];

  readonly displayBalls = computed(() =>
    this.selectedBalls().map((ball) => {
      const metrics = getBallMetrics(ball);
      return {
        data: ball,
        metrics,
        hookBarColor: this.getMetricBarColor(metrics.hookScore),
        flareBarColor: this.getMetricBarColor(metrics.flareScore),
      };
    }),
  );

  private static readonly STORAGE_KEY = 'ball-compare-selected-ids';
  private chartInstance: Chart | null = null;
  private distChartInstance: Chart | null = null;
  private hasRestored = false;

  constructor() {
    addIcons({ add, chevronDownOutline, closeOutline, scaleOutline });
    this.initChartEffect();
    this.restoreSelection();
  }

  ngOnInit() {
    this.presentingElement = document.querySelector('.ion-page');
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  openAddBallModal(): void {
    this.addBallModal?.present();
  }

  onBallSelectionChange(selected: Ball[]): void {
    void this.ballsStore.rememberBalls(selected);
    this.selectedBalls.set(selected);
    this.saveSelectedIds(selected);
  }

  removeBall(ball: Ball): void {
    this.selectedBalls.update((balls) => {
      const updated = balls.filter((b) => b.ball_id !== ball.ball_id);
      this.saveSelectedIds(updated);
      return updated;
    });
  }

  async onWeightSelect(ball: Ball, weight: string, selectEl: IonSelect): Promise<void> {
    const selectedWeight = Number(weight);
    if (!Number.isFinite(selectedWeight) || selectedWeight === Number(ball.core_weight)) return;

    const key = ball.ball_id + ball.core_weight;
    this.loadingWeightBallIds.update((s) => new Set([...s, key]));

    try {
      const replacementBall = await this.ballService.getBallVariant(ball.ball_id, selectedWeight);

      if (!replacementBall) {
        selectEl.value = ball.core_weight;
        this.toastService.showToast('Selected weight is unavailable for this ball.', 'alert-circle-outline', true);
        return;
      }

      this.selectedBalls.update((balls) => {
        const updated = balls.map((entry) => (entry.ball_id === ball.ball_id ? replacementBall : entry));
        this.saveSelectedIds(updated);
        return updated;
      });
    } catch {
      selectEl.value = ball.core_weight;
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'alert-circle-outline', true);
    } finally {
      this.loadingWeightBallIds.update((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  private getMetricBarColor(score: number): string {
    if (score >= 70) return 'var(--ion-color-success)';
    if (score >= 40) return 'var(--ion-color-warning)';
    return 'var(--ion-color-danger)';
  }

  private initChartEffect(): void {
    effect(() => {
      const balls = this.selectedBalls();
      const segment = this.selectedSegment();

      if (balls.length === 0) {
        this.destroyCharts();
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout>;

      if (segment === 'compare') {
        timeoutId = setTimeout(() => this.generateBallComparisonChart(), 50);
      } else if (segment === 'chart') {
        timeoutId = setTimeout(() => this.generateBallDistributionChart(), 50);
      }

      return () => clearTimeout(timeoutId);
    });
  }

  private restoreSelection(): void {
    const raw = localStorage.getItem(BallComparisonPage.STORAGE_KEY);
    if (!raw) return;

    let entries: SavedEntry[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      entries = typeof parsed[0] === 'string' ? parsed.map((id: string) => ({ id, weight: '15' })) : parsed;
    } catch {
      return;
    }

    if (this.hasRestored) return;
    this.hasRestored = true;
    void this.restoreFromEntries(entries);
  }

  /** Restores the saved selection: known balls first, the rest from the ball API by id. */
  private async restoreFromEntries(entries: SavedEntry[]): Promise<void> {
    const matches = (ball: Ball, { id, weight }: SavedEntry) => ball.ball_id === id && Number(ball.core_weight) === Number(weight);
    const known = this.ballsStore.knownBalls();
    const missing = entries.filter((entry) => !known.some((ball) => matches(ball, entry)));

    let fetched: Ball[] = [];
    if (missing.length > 0) {
      try {
        fetched = await this.ballService.getBallsByIds(missing.map((entry) => entry.id));
        await this.ballsStore.rememberBalls(fetched.filter((ball) => missing.some((entry) => matches(ball, entry))));
      } catch (error) {
        console.error('Error restoring compared balls:', error);
      }
    }

    const pool = [...known, ...fetched];
    const restored = entries.map((entry) => pool.find((ball) => matches(ball, entry))).filter((b): b is Ball => !!b);
    if (restored.length > 0) this.selectedBalls.set(restored);
  }

  private saveSelectedIds(balls: Ball[]): void {
    const entries: SavedEntry[] = balls.map((b) => ({ id: b.ball_id, weight: b.core_weight }));
    localStorage.setItem(BallComparisonPage.STORAGE_KEY, JSON.stringify(entries));
  }

  private destroyCharts(): void {
    this.chartInstance?.destroy();
    this.chartInstance = null;
    this.distChartInstance?.destroy();
    this.distChartInstance = null;
  }

  private generateBallComparisonChart(): void {
    if (!this.chartCanvas) return;
    this.chartInstance = this.chartGenerationService.generateBallComparisonChart(this.chartCanvas, this.selectedBalls(), this.chartInstance);
  }

  private generateBallDistributionChart(): void {
    if (!this.distChartCanvas) return;
    const balls = this.selectedBalls();
    if (balls.length === 0) return;

    try {
      this.distChartInstance = this.chartGenerationService.generateBallDistributionChart(
        this.distChartCanvas,
        balls,
        this.distChartInstance ?? undefined,
      );
    } catch (error) {
      console.error('Error generating ball distribution chart:', error);
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
    }
  }
}
