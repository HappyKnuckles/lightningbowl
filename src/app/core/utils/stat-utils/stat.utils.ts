import { environment } from 'src/environments/environment';
import { HighlightItemStats } from '../../models/stats.model';

const DEFAULT_HIGHLIGHT: HighlightItemStats = {
  name: '',
  image: '',
  avg: 0,
  highestGame: 0,
  lowestGame: 0,
  gameCount: 0,
  cleanGameCount: 0,
  strikeRate: 0,
};

export function pickTop(
  stats: Record<string, HighlightItemStats>,
  cmp: (a: HighlightItemStats, b: HighlightItemStats) => number,
): HighlightItemStats {
  return pickTopFromList(Object.values(stats), cmp);
}

export function pickTopFromList(items: HighlightItemStats[], cmp: (a: HighlightItemStats, b: HighlightItemStats) => number): HighlightItemStats {
  return items.length ? items.reduce((best, x) => (cmp(x, best) < 0 ? x : best)) : DEFAULT_HIGHLIGHT;
}

export function buildHighlights(src: {
  mostPlayedBall: HighlightItemStats;
  bestBall: HighlightItemStats;
  allBalls: HighlightItemStats[];
  mostPlayedPattern: HighlightItemStats;
  bestPattern: HighlightItemStats;
  allPatterns: HighlightItemStats[];
}) {
  return [
    {
      title: 'Most used ball',
      item: src.mostPlayedBall,
      allItems: src.allBalls,
      sortMode: 'gameCount' as const,
      emptyMessage: 'No Games with balls saved.',
      imageUrlBase: undefined,
      roundImage: true,
    },
    {
      title: 'Best ball',
      item: src.bestBall,
      allItems: src.allBalls,
      sortMode: 'avg' as const,
      emptyMessage: 'No Games with balls saved.',
      imageUrlBase: undefined,
      roundImage: true,
    },
    {
      title: 'Most played pattern',
      item: src.mostPlayedPattern,
      allItems: src.allPatterns,
      sortMode: 'gameCount' as const,
      emptyMessage: 'No Games with patterns saved.',
      imageUrlBase: environment.imagesUrl,
      roundImage: false,
    },
    {
      title: 'Best pattern',
      item: src.bestPattern,
      allItems: src.allPatterns,
      sortMode: 'avg' as const,
      emptyMessage: 'No Games with patterns saved.',
      imageUrlBase: environment.imagesUrl,
      roundImage: false,
    },
  ];
}

/**
 * Shared colour ramp for a conversion/spare rate, so the same percentage reads the same
 * colour on the spare table, the leave cards and the ball detail deck.
 */
export function getRateColor(rate: number): string {
  if (rate > 95) return '#4faeff';
  if (rate > 75) return '#008000';
  if (rate > 50) return '#809300';
  if (rate > 33) return '#ffa500';
  return '#ff0000';
}
