import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, model, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
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
} from '@ionic/angular/standalone';
import type { Chart } from 'chart.js';
import { addIcons } from 'ionicons';
import { add, closeOutline, scaleOutline } from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { getBallMetrics } from 'src/app/core/services/ball/ball-metrics.util';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-config.interface';
import { createBallTypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-configs';

@Component({
  selector: 'app-ball-compare',
  templateUrl: './ball-compare.page.html',
  styleUrls: ['./ball-compare.page.scss'],
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
  ],
})
export class BallComparePage implements OnInit, OnDestroy {
  readonly storageService = inject(StorageService);
  private readonly chartGenerationService = inject(ChartGenerationService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('addBallModal', { static: false }) addBallModal!: IonModal;
  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('distChartCanvas', { static: false }) distChartCanvas?: ElementRef;

  readonly selectedBalls = signal<Ball[]>([]);
  readonly selectedSegment = model<'compare' | 'chart'>('compare');

  presentingElement?: HTMLElement;
  ballTypeaheadConfig!: TypeaheadConfig<Ball>;

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

  readonly maxBalls = 6;
  readonly selectedBallIds = computed(() => this.selectedBalls().map((b) => b.ball_id));

  private static readonly STORAGE_KEY = 'ball-compare-selected-ids';
  private chartInstance: Chart | null = null;
  private distChartInstance: Chart | null = null;

  constructor() {
    addIcons({ add, closeOutline, scaleOutline });
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
    const raw = localStorage.getItem(BallComparePage.STORAGE_KEY);
    if (!raw) return;

    let ids: string[];
    try {
      ids = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length === 0) return;
    } catch {
      return;
    }

    // Effect re-runs automatically once allBalls() is populated
    effect(
      () => {
        const allBalls = this.storageService.allBalls();
        if (allBalls.length === 0) return;

        const restored = ids.map((id) => allBalls.find((b) => b.ball_id === id)).filter((b): b is Ball => !!b);

        if (restored.length > 0) this.selectedBalls.set(restored);
      },
      { allowSignalWrites: true },
    );
  }

  private saveSelectedIds(balls: Ball[]): void {
    const ids = balls.map((b) => b.ball_id);
    localStorage.setItem(BallComparePage.STORAGE_KEY, JSON.stringify(ids));
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
