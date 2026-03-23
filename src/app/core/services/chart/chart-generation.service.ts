import { ElementRef, inject, Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { Stats } from 'src/app/core/models/stats.model';
import { Ball } from '../../models/ball.model';

import { generateScoreChart, generateScoreDistributionChart, generateAverageScoreChart } from './generation/score-chart-generator';
import { generatePinChart, generateSpareDistributionChart } from './generation/pin-spare-chart-generator';
import { generateThrowChart } from './generation/throw-chart-generator';
import { generateBallDistributionChart } from './generation/ball-distribution-chart-generator';
import { Chart } from 'chart.js';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class ChartGenerationService {
  private translate = inject(TranslateService);

  /**
   * Generate score chart showing average over time and difference from average
   */
  generateScoreChart(
    scoreChart: ElementRef,
    games: Game[],
    existingChartInstance: Chart | undefined,
    viewMode?: 'week' | 'game' | 'session' | 'monthly' | 'yearly',
    onToggleView?: () => void,
    isReload?: boolean,
  ): Chart {
    return generateScoreChart(scoreChart, games, existingChartInstance, viewMode, onToggleView, isReload, {
      averageOverTime: this.translate.instant('CHART.AVERAGE_OVER_TIME'),
      differenceFromAvg: this.translate.instant('CHART.DIFFERENCE_FROM_AVG'),
      gamesPlayed: this.translate.instant('CHART.GAMES_PLAYED'),
    });
  }

  /**
   * Generate score distribution chart showing frequency of scores in ranges
   */
  generateScoreDistributionChart(
    scoreDistributionChart: ElementRef,
    games: Game[],
    existingChartInstance: Chart | undefined,
    isReload?: boolean,
  ): Chart {
    return generateScoreDistributionChart(scoreDistributionChart, games, existingChartInstance, isReload, {
      scoreDistribution: this.translate.instant('CHART.SCORE_DISTRIBUTION'),
    });
  }

  /**
   * Generate average score chart showing average scores over time
   */
  generateAverageScoreChart(
    scoreChart: ElementRef,
    games: Game[],
    existingChartInstance: Chart | undefined,
    viewMode?: 'session' | 'weekly' | 'monthly' | 'yearly',
    onToggleView?: () => void,
    isReload?: boolean,
  ): Chart {
    return generateAverageScoreChart(scoreChart, games, existingChartInstance, viewMode, onToggleView, isReload, {
      averageScore: this.translate.instant('CHART.AVERAGE_SCORE'),
      gamesPlayed: this.translate.instant('CHART.GAMES_PLAYED'),
    });
  }

  /**
   * Generate pin chart (radar) showing spare conversion rates
   */
  generatePinChart(pinChart: ElementRef, stats: Stats, existingChartInstance: Chart | undefined, isReload?: boolean): Chart {
    return generatePinChart(pinChart, stats, existingChartInstance, isReload, {
      converted: this.translate.instant('CHART.CONVERTED'),
      missed: this.translate.instant('CHART.MISSED'),
      pinLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
        n === 1 ? this.translate.instant('CHART.ONE_PIN') : this.translate.instant('CHART.N_PINS', { count: n }),
      ),
    });
  }

  /**
   * Generate spare distribution chart showing appearance and hit counts per pin
   */
  generateSpareDistributionChart(
    spareDistributionChart: ElementRef,
    stats: Stats,
    existingChartInstance: Chart | undefined,
    isReload?: boolean,
  ): Chart {
    return generateSpareDistributionChart(spareDistributionChart, stats, existingChartInstance, isReload, {
      appearanceCount: this.translate.instant('CHART.APPEARANCE_COUNT'),
      hitCount: this.translate.instant('CHART.HIT_COUNT'),
    });
  }

  /**
   * Generate throw chart (radar) showing strike, spare, and open percentages
   */
  generateThrowChart(throwChart: ElementRef, stats: Stats, existingChartInstance: Chart | undefined, isReload?: boolean): Chart {
    return generateThrowChart(throwChart, stats, existingChartInstance, isReload, {
      spare: this.translate.instant('CHART.SPARE'),
      strike: this.translate.instant('CHART.STRIKE'),
      open: this.translate.instant('CHART.OPEN'),
      percentage: this.translate.instant('CHART.PERCENTAGE'),
    });
  }

  /**
   * Generate ball distribution chart showing RG vs Diff scatter plot with ball images
   */
  generateBallDistributionChart(
    ballDistributionChartCanvas: ElementRef,
    balls: Ball[],
    existingChartInstance: Chart | undefined,
    isReload?: boolean,
  ): Chart {
    return generateBallDistributionChart(ballDistributionChartCanvas, balls, existingChartInstance, isReload, {
      bowlingBalls: this.translate.instant('CHART.BOWLING_BALLS'),
    });
  }
}
