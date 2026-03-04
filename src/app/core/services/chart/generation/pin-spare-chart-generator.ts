import { ElementRef } from '@angular/core';
import Chart from 'chart.js/auto';
import { Stats } from 'src/app/core/models/stats.model';
import { calculatePinChartDataForRadar } from '../data-calculation/chart-data-calculators';

/**
 * Generate pin chart (radar) showing spare conversion rates
 */
export function generatePinChart(
  pinChart: ElementRef,
  stats: Stats,
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
  labels?: { converted: string; missed: string; pinLabels: string[] },
): Chart {
  try {
    const { filteredSpareRates, filteredMissedCounts } = calculatePinChartDataForRadar(stats);
    const ctx = pinChart.nativeElement;

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.datasets[0].data = filteredSpareRates;
      existingChartInstance.data.datasets[1].data = filteredMissedCounts;
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      return new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels?.pinLabels ?? ['1 Pin', '2 Pins', '3 Pins', '4 Pins', '5 Pins', '6 Pins', '7 Pins', '8 Pins', '9 Pins', '10 Pins'],
          datasets: [
            {
              label: labels?.converted ?? 'Converted',
              data: filteredSpareRates,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
              pointHitRadius: 10,
            },
            {
              label: labels?.missed ?? 'Missed',
              data: filteredMissedCounts,
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
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
              },
              angleLines: {
                color: 'rgba(128, 128, 128, 0.3)',
              },
              pointLabels: {
                color: 'gray',
                font: {
                  size: 14,
                },
              },
              ticks: {
                backdropColor: 'transparent',
                color: 'white',
                display: false,
              },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: function (context) {
                  const value = context[0].raw;

                  const matchingLabels = context[0].chart.data.labels!.filter((label, index) => {
                    return context[0].chart.data.datasets.some((dataset) => dataset.data[index] === value && value === 0);
                  });

                  // Only modify the title if multiple labels match the same value
                  if (matchingLabels.length > 1) {
                    // Extract only the numbers from each label and join them
                    const extractedNumbers = matchingLabels.map((label) => {
                      // Use regex to extract the number part from the label (e.g., "1 Pin" -> "1")
                      const match = (label as string).match(/\d+/);
                      return match ? match[0] : ''; // Return the matched number or an empty string if no match
                    });

                    // Return the combined numbers as the title (e.g., "2, 3 Pins")
                    return extractedNumbers.join(', ') + ' Pins';
                  }

                  // Default behavior: return the original label if only one match
                  return context[0].label || '';
                },
                label: function (context) {
                  // Create the base label with dataset name and value percentage
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
            legend: {
              display: true,
              labels: {
                font: {
                  size: 15,
                },
              },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Error generating pin chart:', error);
    throw error;
  }
}

/**
 * Generate spare distribution chart showing appearance and hit counts per pin
 */
export function generateSpareDistributionChart(
  spareDistributionChart: ElementRef,
  stats: Stats,
  existingChartInstance: Chart | undefined,
  isReload?: boolean,
  labels?: { appearanceCount: string; hitCount: string },
): Chart {
  try {
    const ctx = spareDistributionChart.nativeElement;

    const pinCounts = Array.from({ length: 10 }, (_, i) => (i + 1).toString());
    const appearanceCounts = stats.pinCounts.slice(1).map((count, index) => count + stats.missedCounts[index + 1]);
    const hitCounts = stats.pinCounts.slice(1);

    if (isReload && existingChartInstance) {
      existingChartInstance.destroy();
    }

    if (existingChartInstance && !isReload) {
      existingChartInstance.data.labels = pinCounts;
      existingChartInstance.data.datasets[0].data = appearanceCounts;
      existingChartInstance.data.datasets[1].data = hitCounts;
      existingChartInstance.update();
      return existingChartInstance;
    } else {
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: pinCounts,
          datasets: [
            {
              label: labels?.appearanceCount ?? 'Appearance Count',
              data: appearanceCounts,
              backgroundColor: 'rgba(153, 102, 255, 0.1)',
              borderColor: 'rgba(153, 102, 255, .5)',
              borderWidth: 1,
            },
            {
              label: labels?.hitCount ?? 'Hit Count',
              data: hitCounts,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: {
            x: {
              ticks: {
                font: {
                  size: 14,
                },
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Frequency',
                color: 'white',
                font: {
                  size: 16,
                },
              },
              ticks: {
                font: {
                  size: 14,
                },
              },
            },
          },
          plugins: {
            title: {
              display: false,
              text: 'Spare Distribution',
              color: 'white',
              font: {
                size: 20,
              },
            },
            legend: {
              display: true,
              labels: {
                font: {
                  size: 15,
                },
              },
            },
            tooltip: {
              callbacks: {
                title: function (context) {
                  const index = context[0].dataIndex;
                  return `${index + 1} Pin${index + 1 > 1 ? 's' : ''}`;
                },
              },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error('Error generating spare distribution chart:', error);
    throw error;
  }
}
