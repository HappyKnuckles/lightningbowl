import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { Stats } from 'src/app/core/models/stats.model';
import { calculateThrowChartDataPercentages } from '../data-calculation/chart-data-calculators';

/**
 * Generate throw chart (radar) showing strike, spare, and open percentages
 */
export function generateThrowChart(
  throwChart: ElementRef,
  stats: Stats,
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
  labels?: { spare: string; strike: string; open: string; percentage: string },
): Chart {
  try {
    const { opens, spares, strikes } = calculateThrowChartDataPercentages(stats);
    const ctx = throwChart.nativeElement;

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.datasets[0].data = [spares, strikes, opens];
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      return new Chart(ctx, {
        type: 'radar',
        data: {
          labels: [labels?.spare ?? 'Spare', labels?.strike ?? 'Strike', labels?.open ?? 'Open'],
          datasets: [
            {
              label: labels?.percentage ?? 'Percentage',
              data: [spares, strikes, opens],
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgb(54, 162, 235)',
              pointBackgroundColor: 'rgb(54, 162, 235)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(54, 162, 235)',
              pointHitRadius: 10,
            },
          ],
        },
        options: {
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              grid: {
                color: 'rgba(128, 128, 128, 0.3)',
                lineWidth: 0.5,
              },
              angleLines: {
                color: 'rgba(128, 128, 128, 0.3)',
                lineWidth: 0.5,
              },
              pointLabels: {
                color: 'gray',
                font: {
                  size: 14,
                },
              },
              ticks: {
                display: false,
                backdropColor: 'transparent',
                color: 'white',
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.r !== null) {
                    label += context.parsed.r + '%';
                  }
                  return label;
                },
              },
            },
          },
          layout: {
            padding: {
              top: 10,
              bottom: 10,
            },
          },
          elements: {
            line: {
              borderWidth: 2,
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Error generating throw chart:', error);
    throw error;
  }
}
