import { ElementRef } from '@angular/core';
import Chart, { Plugin, ChartEvent, LegendItem, ChartOptions, LegendElement, ChartDataset } from 'chart.js/auto';
import { Game } from 'src/app/core/models/game.model';
import { calculateScoreChartData, calculateAverageScoreChartData } from '../data-calculation/chart-data-calculators';

/**
 * Generate score chart showing average over time and difference from average
 */
export function generateScoreChart(
  scoreChart: ElementRef,
  games: Game[],
  existingChartInstance: Chart | undefined,
  viewMode?: 'week' | 'game' | 'session' | 'monthly' | 'yearly',
  onToggleView?: () => void,
  isReload?: boolean,
  labels?: { averageOverTime: string; differenceFromAvg: string; gamesPlayed: string },
): Chart {
  try {
    const currentViewMode = viewMode || 'game';
    const { gameLabels, overallAverages, differences, gamesPlayedDaily } = calculateScoreChartData(games, currentViewMode);
    const ctx = scoreChart.nativeElement;
    let chartInstance: Chart;

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    const plugins: Plugin<'line' | 'bar'>[] = [];
    const options: ChartOptions<'line' | 'bar'> = {
      layout: {
        padding: {
          top: 40,
        },
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: 300, ticks: { font: { size: 14 } } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 14 } } },
      },
      plugins: {
        legend: {
          display: true,
          labels: { font: { size: 15 } },
          onClick: (e: ChartEvent, legendItem: LegendItem, legend: LegendElement<'line' | 'bar'>) => {
            const index = legendItem.datasetIndex!;
            const ci = legend.chart;
            const meta = ci.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : !meta.hidden;
            const gamesPlayedIndex = ci.data.datasets.findIndex((dataset: ChartDataset) => dataset.label === (labels?.gamesPlayed ?? 'Games played'));
            if (gamesPlayedIndex !== -1) {
              const gamesPlayedMeta = ci.getDatasetMeta(gamesPlayedIndex);
              if (ci.options.scales && ci.options.scales['y1']) {
                ci.options.scales['y1'].display = !gamesPlayedMeta.hidden;
              }
            }
            ci.update();
          },
        },
      },
    };

    if (onToggleView && viewMode) {
      const toggleButtonPlugin = createToggleButtonPlugin(viewMode);
      plugins.push(toggleButtonPlugin);
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.labels = gameLabels;
      existingChartInstance.data.datasets[0].data = overallAverages;
      existingChartInstance.data.datasets[1].data = differences;
      existingChartInstance.data.datasets[2].data = gamesPlayedDaily;
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: gameLabels,
          datasets: [
            {
              label: labels?.averageOverTime ?? 'Average over time',
              data: overallAverages,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
              pointHitRadius: 10,
            },
            {
              label: labels?.differenceFromAvg ?? 'Difference from average',
              data: differences,
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
              pointHitRadius: 10,
            },
            {
              label: labels?.gamesPlayed ?? 'Games played',
              data: gamesPlayedDaily,
              type: 'bar',
              backgroundColor: 'rgba(153, 102, 255, 0.1)',
              borderColor: 'rgba(153, 102, 255, .5)',
              borderWidth: 1,
              yAxisID: 'y1',
            },
          ],
        },
        options: options,
        plugins: plugins,
      });

      if (onToggleView) {
        attachToggleButtonClickHandler(chartInstance, onToggleView);
      }
    }

    return chartInstance;
  } catch (error) {
    console.error('Error generating score chart:', error);
    throw error;
  }
}

/**
 * Generate score distribution chart showing frequency of scores in ranges
 */
export function generateScoreDistributionChart(
  scoreDistributionChart: ElementRef,
  games: Game[],
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
  labels?: { scoreDistribution: string },
): Chart {
  try {
    const ctx = scoreDistributionChart.nativeElement;

    const scoreLabels = Array.from({ length: 30 }, (_, i) => {
      const start = i * 10;
      const end = i < 29 ? i * 10 + 9 : 300;
      return `${start}-${end}`;
    });
    const scoreDistribution = new Array<number>(30).fill(0);

    games.forEach((game) => {
      const score = Math.min(Math.max(game.totalScore, 0), 299);
      const index = Math.floor(score / 10);
      scoreDistribution[index]++;
    });

    const compressedLabels: string[] = [];
    const compressedData: number[] = [];
    let zeroStart: number | null = null;

    for (let i = 0; i < scoreLabels.length; i++) {
      if (scoreDistribution[i] === 0) {
        if (zeroStart === null) zeroStart = i;
      } else {
        if (zeroStart !== null) {
          compressedLabels.push(`${zeroStart * 10}-${(i - 1) * 10 + 9}`);
          compressedData.push(0);
          zeroStart = null;
        }
        compressedLabels.push(scoreLabels[i]);
        compressedData.push(scoreDistribution[i]);
      }
    }
    if (zeroStart !== null) {
      compressedLabels.push(`${zeroStart * 10}-${(scoreLabels.length - 1) * 10 + 9}`);
      compressedData.push(0);
    }

    const finalLabels = compressedLabels;
    const finalData = compressedData;
    const maxFrequency = Math.max(...finalData);

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.labels = finalLabels;
      existingChartInstance.data.datasets[0].data = finalData;
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: finalLabels,
          datasets: [
            {
              label: labels?.scoreDistribution ?? 'Score Distribution',
              data: finalData,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: {
            x: { ticks: { font: { size: 14 } } },
            y: {
              beginAtZero: true,
              suggestedMax: maxFrequency + 1,
              title: {
                display: true,
                text: 'Frequency',
                color: 'white',
                font: { size: 16 },
              },
              ticks: { font: { size: 14 } },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
  } catch (error) {
    console.error('Error generating score distribution chart:', error);
    throw error;
  }
}

/**
 * Generate average score chart showing average scores over time
 */
export function generateAverageScoreChart(
  scoreChart: ElementRef,
  games: Game[],
  existingChartInstance: Chart | undefined,
  viewMode?: 'session' | 'weekly' | 'monthly' | 'yearly',
  onToggleView?: () => void,
  isReload?: boolean,
  labels?: { averageScore: string; gamesPlayed: string },
): Chart {
  try {
    const currentViewMode = viewMode || 'monthly';
    const { gameLabels, averages, gamesPlayedDaily } = calculateAverageScoreChartData(games, currentViewMode);
    const ctx = scoreChart.nativeElement;
    let chartInstance: Chart;

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    const plugins: Plugin<'line' | 'bar'>[] = [];
    const options: ChartOptions<'line' | 'bar'> = {
      layout: {
        padding: {
          top: 40,
        },
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: 300, ticks: { font: { size: 14 } } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 14 } } },
      },
      plugins: {
        legend: {
          display: true,
          labels: { font: { size: 15 } },
          onClick: (e: ChartEvent, legendItem: LegendItem, legend: LegendElement<'line' | 'bar'>) => {
            const index = legendItem.datasetIndex!;
            const ci = legend.chart;
            const meta = ci.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : !meta.hidden;
            const gamesPlayedIndex = ci.data.datasets.findIndex((dataset: ChartDataset) => dataset.label === (labels?.gamesPlayed ?? 'Games played'));
            if (gamesPlayedIndex !== -1) {
              const gamesPlayedMeta = ci.getDatasetMeta(gamesPlayedIndex);
              if (ci.options.scales && ci.options.scales['y1']) {
                ci.options.scales['y1'].display = !gamesPlayedMeta.hidden;
              }
            }
            ci.update();
          },
        },
      },
    };

    if (onToggleView && viewMode) {
      const toggleButtonPlugin = createAverageToggleButtonPlugin(viewMode);
      plugins.push(toggleButtonPlugin);
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.labels = gameLabels;
      existingChartInstance.data.datasets[0].data = averages;
      existingChartInstance.data.datasets[1].data = gamesPlayedDaily;
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: gameLabels,
          datasets: [
            {
              label: labels?.averageScore ?? 'Average score',
              data: averages,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
              pointHitRadius: 10,
            },
            {
              label: labels?.gamesPlayed ?? 'Games played',
              data: gamesPlayedDaily,
              type: 'bar',
              backgroundColor: 'rgba(153, 102, 255, 0.1)',
              borderColor: 'rgba(153, 102, 255, .5)',
              borderWidth: 1,
              yAxisID: 'y1',
            },
          ],
        },
        options: options,
        plugins: plugins,
      });

      if (onToggleView) {
        attachAverageToggleButtonClickHandler(chartInstance, onToggleView);
      }
    }

    return chartInstance;
  } catch (error) {
    console.error('Error generating average score chart:', error);
    throw error;
  }
}

// Helper functions

function createToggleButtonPlugin(viewMode: string): Plugin<'line' | 'bar'> {
  return {
    id: 'toggleButton',
    afterDraw: (chart: Chart) => {
      const { ctx } = chart;

      const fontSize = Math.max(10, Math.min(14, chart.width / 35));
      const padding = 10;

      const buttonTextMap: Record<string, string> = {
        game: 'By Session',
        session: 'Weekly',
        week: 'Monthly',
        monthly: 'Yearly',
        yearly: 'By Game',
      };
      const buttonText = buttonTextMap[viewMode] || 'By Game';
      const textMetrics = ctx.measureText(buttonText);

      const button = {
        width: textMetrics.width + padding * 2,
        height: fontSize + padding,
        x: chart.width - (textMetrics.width + padding * 2) - 10,
        y: 10,
      };

      (chart as { toggleButtonBounds?: typeof button }).toggleButtonBounds = button;

      ctx.save();
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = 'rgba(153, 102, 255, 0.8)';
      ctx.strokeStyle = 'rgba(153, 102, 255, 1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(button.x, button.y, button.width, button.height, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonText, button.x + button.width / 2, button.y + button.height / 2);
      ctx.restore();
    },
  };
}

function createAverageToggleButtonPlugin(viewMode: string): Plugin<'line' | 'bar'> {
  return {
    id: 'toggleButton',
    afterDraw: (chart: Chart) => {
      const { ctx } = chart;

      const fontSize = Math.max(10, Math.min(14, chart.width / 35));
      const padding = 10;

      const buttonTextMap: Record<string, string> = {
        session: 'Weekly',
        weekly: 'Monthly',
        monthly: 'Yearly',
        yearly: 'By Session',
      };
      const buttonText = buttonTextMap[viewMode] || 'Monthly';
      const textMetrics = ctx.measureText(buttonText);

      const button = {
        width: textMetrics.width + padding * 2,
        height: fontSize + padding,
        x: chart.width - (textMetrics.width + padding * 2) - 10,
        y: 10,
      };

      (chart as { toggleButtonBounds?: typeof button }).toggleButtonBounds = button;

      ctx.save();
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = 'rgba(153, 102, 255, 0.8)';
      ctx.strokeStyle = 'rgba(153, 102, 255, 1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(button.x, button.y, button.width, button.height, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(buttonText, button.x + button.width / 2, button.y + button.height / 2);
      ctx.restore();
    },
  };
}

function attachToggleButtonClickHandler(chartInstance: Chart, onToggleView: () => void): void {
  chartInstance.canvas.onclick = (event) => {
    const rect = chartInstance.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const buttonBounds = (chartInstance as { toggleButtonBounds?: { x: number; y: number; width: number; height: number } }).toggleButtonBounds;
    if (
      buttonBounds &&
      x >= buttonBounds.x &&
      x <= buttonBounds.x + buttonBounds.width &&
      y >= buttonBounds.y &&
      y <= buttonBounds.y + buttonBounds.height
    ) {
      onToggleView();
    }
  };
}

function attachAverageToggleButtonClickHandler(chartInstance: Chart, onToggleView: () => void): void {
  chartInstance.canvas.onclick = (event) => {
    const rect = chartInstance.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const button = { x: chartInstance.width - 120, y: 10, width: 110, height: 30 };

    if (x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) {
      onToggleView();
    }
  };
}
