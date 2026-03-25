import { ElementRef, Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { Stats } from 'src/app/core/models/stats.model';
import { Ball } from '../../models/ball.model';

import { generateScoreChart, generateScoreDistributionChart, generateAverageScoreChart } from './generation/score-chart-generator';
import { generatePinChart, generateSpareDistributionChart } from './generation/pin-spare-chart-generator';
import { generateThrowChart } from './generation/throw-chart-generator';
import { generateBallDistributionChart } from './generation/ball-distribution-chart-generator';
import { Chart } from 'chart.js';
import { generateBallComparisonChart } from './generation/ball-compare-chart-generator';

@Injectable({
  providedIn: 'root',
})
export class ChartGenerationService {
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
    return generateScoreChart(scoreChart, games, existingChartInstance, viewMode, onToggleView, isReload);
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
    return generateScoreDistributionChart(scoreDistributionChart, games, existingChartInstance, isReload);
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
    return generateAverageScoreChart(scoreChart, games, existingChartInstance, viewMode, onToggleView, isReload);
  }

  /**
   * Generate pin chart (radar) showing spare conversion rates
   */
  generatePinChart(pinChart: ElementRef, stats: Stats, existingChartInstance: Chart | undefined, isReload?: boolean): Chart {
    return generatePinChart(pinChart, stats, existingChartInstance, isReload);
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
    return generateSpareDistributionChart(spareDistributionChart, stats, existingChartInstance, isReload);
  }

  /**
   * Generate throw chart (radar) showing strike, spare, and open percentages
   */
  generateThrowChart(throwChart: ElementRef, stats: Stats, existingChartInstance: Chart | undefined, isReload?: boolean): Chart {
    return generateThrowChart(throwChart, stats, existingChartInstance, isReload);
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
    return generateBallDistributionChart(ballDistributionChartCanvas, balls, existingChartInstance, isReload);
  }

  /**
   * Generate ball comparison radar chart comparing hook, length, and flare metrics
   */
  generateBallComparisonChart(comparisonChartCanvas: ElementRef, balls: Ball[], existingChartInstance: Chart | null): Chart | null {
    return generateBallComparisonChart(comparisonChartCanvas, balls, existingChartInstance);
  }
}
