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
  const items = Object.values(stats);
  return items.length ? items.reduce((best, x) => (cmp(x, best) < 0 ? x : best)) : DEFAULT_HIGHLIGHT;
}
