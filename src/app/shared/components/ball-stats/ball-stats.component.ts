import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonRippleEffect,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonLabel,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForwardOutline } from 'ionicons/icons';
import {
  BALL_FIRST_BALL_STAT_DEFINITIONS,
  BALL_LEAVE_STAT_DEFINITIONS,
  BALL_SCORING_STAT_DEFINITIONS,
  BALL_SPARE_STAT_DEFINITIONS,
  BALL_USAGE_STAT_DEFINITIONS,
} from 'src/app/core/configs/stat-definitions/stat-definitions';
import { BALL_STAT_MIN_SAMPLES, BallStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { getRateColor } from 'src/app/core/utils/stat-utils/stat.utils';

import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { StatDisplayComponent } from '../stat-display/stat-display.component';
import { StatPinLeaveComponent } from '../stat-pin-leave/stat-pin-leave.component';

/**
 * One card in the comparison list. Tracking is a property of each game, not of the ball,
 * so a ball can carry both kinds of history at once: game-level numbers over everything
 * it played, and per-throw numbers over the subset that recorded a ball per throw.
 */
interface BallRowVm {
  ball: BallStats;
  hasDetail: boolean;
  tierLabel: string;
  metrics: { label: string; value: string }[];
}

@Component({
  selector: 'app-ball-stats',
  templateUrl: './ball-stats.component.html',
  styleUrls: ['./ball-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonImg,
    IonLabel,
    IonModal,
    IonRippleEffect,
    IonSegment,
    IonSegmentButton,
    IonSegmentContent,
    IonSegmentView,
    IonTitle,
    IonToolbar,
    PinDeckComponent,
    StatDisplayComponent,
    StatPinLeaveComponent,
  ],
})
export class BallStatsComponent {
  ballsStore = inject(BallsStore);

  readonly ballStats = input.required<BallStats[]>();
  readonly title = input<string>('Balls');

  /**
   * Which games these numbers cover. The same ball reads differently on a filtered page
   * than it does across all time, so the scope is stated rather than left to be guessed.
   */
  readonly scopeLabel = input<string>('');

  readonly USAGE_DEFINITIONS = BALL_USAGE_STAT_DEFINITIONS;
  readonly FIRST_BALL_DEFINITIONS = BALL_FIRST_BALL_STAT_DEFINITIONS;
  readonly LEAVE_DEFINITIONS = BALL_LEAVE_STAT_DEFINITIONS;
  readonly SPARE_DEFINITIONS = BALL_SPARE_STAT_DEFINITIONS;
  readonly SCORING_DEFINITIONS = BALL_SCORING_STAT_DEFINITIONS;

  private readonly detailContent = viewChild(IonContent);

  readonly selectedKey = signal<string | null>(null);
  readonly detailSegment = signal<'overview' | 'leaves' | 'spares' | 'patterns'>('overview');

  readonly rows = computed<BallRowVm[]>(() =>
    this.ballStats().map((ball) => {
      const detail = ball.detail;
      const hasDetail = ball.tier === 'detailed' && !!detail;

      const metrics = hasDetail
        ? [
            { label: 'Avg', value: this.formatNumber(ball.avg) },
            { label: 'Proj. avg', value: this.formatNumber(detail!.projectedAverage) },
            { label: 'Strike', value: this.formatPercentage(detail!.strikePercentage) },
            { label: 'Carry', value: this.formatPercentage(detail!.carryPercentage) },
          ]
        : [
            { label: 'Avg', value: this.formatNumber(ball.avg) },
            { label: 'High', value: this.formatNumber(ball.highestGame) },
            { label: 'Low', value: this.formatNumber(ball.lowestGame) },
          ];

      return {
        ball,
        hasDetail,
        tierLabel: this.tierLabel(ball, hasDetail),
        metrics,
      } satisfies BallRowVm;
    }),
  );

  readonly selected = computed(() => this.ballStats().find((ball) => ball.key === this.selectedKey()));

  /** Single-pin conversions ordered the way the deck reads, so the grid is scannable. */
  readonly pinConversions = computed(() =>
    (this.selected()?.detail?.pinConversions ?? []).map((pin) => ({ ...pin, rateColor: getRateColor(pin.pickupPercentage) })),
  );

  readonly topLeaves = computed(() => (this.selected()?.detail?.leaves ?? []).slice(0, 8));

  readonly patternRows = computed(() =>
    (this.selected()?.detail?.patternBreakdown ?? []).filter((row) => row.firstBalls >= BALL_STAT_MIN_SAMPLES.leave),
  );

  constructor() {
    addIcons({ chevronBack, chevronForwardOutline });
  }

  openDetail(row: BallRowVm): void {
    if (!row.hasDetail) return;
    this.detailSegment.set('overview');
    this.selectedKey.set(row.ball.key);
  }

  closeDetail(): void {
    this.selectedKey.set(null);
  }

  onSegmentChange(value: unknown): void {
    if (value === 'overview' || value === 'leaves' || value === 'spares' || value === 'patterns') {
      this.detailSegment.set(value);
      setTimeout(() => this.detailContent()?.scrollToTop(300), 300);
    }
  }

  /**
   * Games played, plus a warning when the rates rest on too few first balls to settle.
   * The numbers themselves stay in the normal colour: dimming a whole card of values is
   * how the sample size ends up looking like a rendering fault rather than a caveat.
   */
  private tierLabel(ball: BallStats, hasDetail: boolean): string {
    const games = `${ball.gameCount} ${ball.gameCount === 1 ? 'game' : 'games'}`;
    if (!hasDetail) return games;

    const parts = [games, `${ball.detailedGameCount} by throw`];

    return parts.join(' · ');
  }

  private formatNumber(value: number): string {
    return value ? String(value) : '-';
  }

  private formatPercentage(value: number): string {
    return `${Math.round(value * 10) / 10}%`;
  }
}
