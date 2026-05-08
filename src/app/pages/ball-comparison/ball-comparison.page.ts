import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, model, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
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
  IonText,
  IonTitle,
  IonToolbar,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import type { Chart } from 'chart.js';
import { addIcons } from 'ionicons';
import { add, chevronDownOutline, closeOutline, scaleOutline } from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-config.interface';
import { createBallTypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-configs';

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
    IonCol,
    IonRow,
    IonGrid,
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
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
export class BallComparisonPage implements OnInit, OnDestroy {
  protected readonly storageService = inject(StorageService);
  private readonly ballService = inject(BallService);
  private readonly chartGenerationService = inject(ChartGenerationService);
  private readonly toastService = inject(ToastService);

  @ViewChild('addBallModal', { static: false }) addBallModal!: IonModal;
  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('distChartCanvas', { static: false }) distChartCanvas?: ElementRef;

  readonly selectedBalls = signal<Ball[]>([]);
  readonly selectedSegment = model<'compare' | 'chart'>('compare');
  readonly loadingWeightBallId = signal<string | null>(null);

  presentingElement?: HTMLElement;
  ballTypeaheadConfig!: TypeaheadConfig<Ball>;

  readonly maxBalls = 6;
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
    this.initRestoreEffect();
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page') ?? undefined;
    this.ballTypeaheadConfig = {
      ...createBallTypeaheadConfig(this.storageService),
      title: 'Select Balls to Compare',
      maxSelections: this.maxBalls,
    };
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  openAddBallModal(): void {
    this.addBallModal?.present();
  }

  onBallSelectionChange(ballIds: string[]): void {
    const allBalls = this.storageService.allBalls();
    const selected = ballIds.map((id) => allBalls.find((b) => b.ball_id === id)).filter((b): b is Ball => !!b);
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

    this.loadingWeightBallId.set(ball.ball_id + selectedWeight);

    try {
      const ballsAtWeight = await this.ballService.getBallsByWeight(selectedWeight);
      const replacementBall = ballsAtWeight.find((c) => c.ball_id === ball.ball_id);

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
      this.toastService.showToast(ToastMessages.ballLoadError, 'alert-circle-outline', true);
    } finally {
      this.loadingWeightBallId.set(null);
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

  private initRestoreEffect(): void {
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

    effect(
      () => {
        const allBalls = this.storageService.allBalls();
        if (allBalls.length === 0 || this.hasRestored) return;
        this.hasRestored = true;
        void this.restoreFromEntries(entries, allBalls);
      },
      { allowSignalWrites: true },
    );
  }

  private async restoreFromEntries(entries: SavedEntry[], allBalls: Ball[]): Promise<void> {
    const defaultBallMap = new Map(allBalls.map((b) => [b.ball_id, b]));

    const resolved = await Promise.all(
      entries.map(async ({ id, weight }) => {
        const defaultBall = defaultBallMap.get(id);
        if (defaultBall && defaultBall.core_weight === weight) return defaultBall;
        const ballsAtWeight = await this.ballService.getBallsByWeight(Number(weight));
        return ballsAtWeight.find((b) => b.ball_id === id) ?? defaultBall ?? null;
      }),
    );

    const restored = resolved.filter((b): b is Ball => !!b);
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
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
    }
  }
}
