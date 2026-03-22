import { Component, computed, OnInit, signal, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
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
} from '@ionic/angular/standalone';
import { Ball } from 'src/app/core/models/ball.model';
import { addIcons } from 'ionicons';
import { add, closeOutline, scaleOutline } from 'ionicons/icons';
import { ModalController } from '@ionic/angular';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-config.interface';
import { createBallTypeaheadConfig } from 'src/app/shared/components/generic-typeahead/typeahead-configs';
import Chart from 'chart.js/auto';

export interface BallMetrics {
  hookScore: number;
  lengthScore: number;
  flareScore: number;
  hookLabel: string;
  lengthLabel: string;
  flareLabel: string;
  laneCondition: string;
  laneConditionColor: string;
}

const CHART_COLORS = [
  { border: 'rgba(99, 179, 237, 0.9)', bg: 'rgba(99, 179, 237, 0.15)' },
  { border: 'rgba(252, 129, 74, 0.9)', bg: 'rgba(252, 129, 74, 0.15)' },
  { border: 'rgba(104, 211, 145, 0.9)', bg: 'rgba(104, 211, 145, 0.15)' },
  { border: 'rgba(214, 158, 246, 0.9)', bg: 'rgba(214, 158, 246, 0.15)' },
];

@Component({
  selector: 'app-ball-compare',
  templateUrl: './ball-compare.page.html',
  styleUrls: ['./ball-compare.page.scss'],
  providers: [ModalController],
  standalone: true,
  imports: [
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
    GenericTypeaheadComponent,
  ],
})
export class BallComparePage implements OnInit {
  storageService = inject(StorageService);

  @ViewChild('addBallModal', { static: false }) addBallModal!: IonModal;
  @ViewChild('chartCanvas', { static: false }) chartCanvas?: ElementRef<HTMLCanvasElement>;

  selectedBalls = signal<Ball[]>([]);
  presentingElement?: HTMLElement;
  ballTypeaheadConfig!: TypeaheadConfig<Ball>;

  readonly maxBalls = 4;

  selectedBallIds = computed(() => this.selectedBalls().map((b) => b.ball_id));

  private chartInstance: Chart | null = null;

  constructor() {
    addIcons({ add, closeOutline, scaleOutline });
    effect(() => {
      // Re-render chart whenever selected balls change
      const balls = this.selectedBalls();
      if (balls.length > 0) {
        // Use a short timeout so the canvas is rendered before we draw
        setTimeout(() => this.renderComparisonChart(), 50);
      } else {
        this.chartInstance?.destroy();
        this.chartInstance = null;
      }
    });
  }

  ngOnInit() {
    this.presentingElement = document.querySelector('.ion-page') ?? undefined;
    this.ballTypeaheadConfig = {
      ...createBallTypeaheadConfig(this.storageService),
      title: 'Select Balls to Compare',
      maxSelections: this.maxBalls,
    };
  }

  openAddBallModal(): void {
    this.addBallModal?.present();
  }

  onBallSelectionChange(ballIds: string[]): void {
    const allBalls = this.storageService.allBalls();
    const selected = ballIds.map((id) => allBalls.find((b) => b.ball_id === id)).filter((b): b is Ball => !!b);
    this.selectedBalls.set(selected);
  }

  removeBall(ball: Ball): void {
    this.selectedBalls.update((balls) => balls.filter((b) => b.ball_id !== ball.ball_id));
  }

  getBallMetrics(ball: Ball): BallMetrics {
    const rg = parseFloat(ball.core_rg);
    const diff = parseFloat(ball.core_diff);
    const coverstockType = (ball.coverstock_type || '').toLowerCase();
    const factoryFinish = (ball.factory_finish || '').toLowerCase();

    // Hook score based on coverstock type (0-100)
    let hookBase = 50;
    if (coverstockType.includes('solid')) hookBase = 88;
    else if (coverstockType.includes('hybrid')) hookBase = 74;
    else if (coverstockType.includes('pearl')) hookBase = 62;
    else if (coverstockType.includes('urethane')) hookBase = 45;
    else if (coverstockType.includes('plastic') || coverstockType.includes('polyester')) hookBase = 10;

    // Adjust by factory finish grit (lower grit = more friction = more hook)
    if (factoryFinish.includes('500')) hookBase = Math.min(100, hookBase + 5);
    else if (factoryFinish.includes('1000')) hookBase = Math.min(100, hookBase + 3);
    else if (factoryFinish.includes('2000')) hookBase = Math.min(100, hookBase + 1);
    else if (factoryFinish.includes('4000')) hookBase = Math.max(0, hookBase - 3);

    const hookScore = hookBase;

    // Length score (0-100, higher = later roll)
    let lengthScore = 50;
    if (!isNaN(rg)) {
      lengthScore = Math.round(Math.min(100, Math.max(0, ((rg - 2.4) / (2.75 - 2.4)) * 100)));
    }

    // Flare score (0-100, higher = more flare)
    let flareScore = 50;
    if (!isNaN(diff)) {
      flareScore = Math.round(Math.min(100, Math.max(0, ((diff - 0.015) / (0.06 - 0.015)) * 100)));
    }

    // Labels
    const hookLabel =
      hookScore >= 80 ? 'Very Strong' : hookScore >= 65 ? 'Strong' : hookScore >= 45 ? 'Medium' : hookScore >= 25 ? 'Weak' : 'Very Weak';
    const lengthLabel = lengthScore >= 70 ? 'Late Roll' : lengthScore >= 40 ? 'Medium Roll' : 'Early Roll';
    const flareLabel = flareScore >= 70 ? 'High Flare' : flareScore >= 40 ? 'Medium Flare' : 'Low Flare';

    // Lane condition recommendation based on hook and flare
    const combined = hookScore * 0.5 + flareScore * 0.3 + (100 - lengthScore) * 0.2;
    let laneCondition = 'Medium Oil';
    let laneConditionColor = 'warning';
    if (combined >= 65) {
      laneCondition = 'Heavy Oil';
      laneConditionColor = 'primary';
    } else if (combined <= 35) {
      laneCondition = 'Dry / Light Oil';
      laneConditionColor = 'danger';
    }

    return { hookScore, lengthScore, flareScore, hookLabel, lengthLabel, flareLabel, laneCondition, laneConditionColor };
  }

  getMetricBarColor(score: number): string {
    if (score >= 70) return 'var(--ion-color-success)';
    if (score >= 40) return 'var(--ion-color-warning)';
    return 'var(--ion-color-danger)';
  }

  getCoverstockClass(coverstockType: string): string {
    return (coverstockType || '').toLowerCase().replace(/ /g, '-');
  }

  private renderComparisonChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;

    const balls = this.selectedBalls();
    if (balls.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const datasets = balls.map((ball, i) => {
      const m = this.getBallMetrics(ball);
      const color = CHART_COLORS[i % CHART_COLORS.length];
      return {
        label: ball.ball_name,
        data: [m.hookScore, m.lengthScore, m.flareScore],
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        pointBackgroundColor: color.border,
        pointRadius: 4,
      };
    });

    this.chartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Hook Potential', 'Length', 'Flare'],
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(255,255,255,0.12)' },
            angleLines: { color: 'rgba(255,255,255,0.12)' },
            pointLabels: {
              color: 'rgba(255,255,255,0.75)',
              font: { size: 13 },
            },
            ticks: {
              backdropColor: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              stepSize: 25,
            },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255,255,255,0.8)',
              boxWidth: 12,
              padding: 12,
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}`,
            },
          },
        },
      },
    });
  }
}

