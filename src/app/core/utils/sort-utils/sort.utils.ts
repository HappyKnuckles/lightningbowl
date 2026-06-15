import { Game } from 'src/app/core/models/game.model';
import { HighlightItemStats } from '../../models/stats.model';

export type ItemSortMode = 'avg' | 'gameCount';
export const byAvg = (a: HighlightItemStats, b: HighlightItemStats) => b.avg - a.avg || b.gameCount - a.gameCount;

export const byGameCount = (a: HighlightItemStats, b: HighlightItemStats) => b.gameCount - a.gameCount || b.avg - a.avg;

export function sortGenericItems(items: HighlightItemStats[], mode: ItemSortMode): HighlightItemStats[] {
  return [...items].sort(mode === 'gameCount' ? byGameCount : byAvg);
}

export function sortGameHistoryByDate(gameHistory: Game[], ascending = false): Game[] {
  return gameHistory.sort((a: { date: number }, b: { date: number }) => {
    if (ascending) {
      return a.date - b.date;
    } else return b.date - a.date;
  });
}

export function sortGamesByLeagues(games: Game[], includePractice?: boolean): Record<string, Game[]> {
  const gamesByLeague = games.reduce((acc: Record<string, Game[]>, game: Game) => {
    const league = game.league || (includePractice ? 'Practice' : '');
    if (!league) return acc;
    if (!acc[league]) {
      acc[league] = [];
    }
    acc[league].push(game);
    return acc;
  }, {});

  const sortedEntries = Object.entries(gamesByLeague).sort((a, b) => b[1].length - a[1].length);

  return sortedEntries.reduce((acc: Record<string, Game[]>, [league, games]) => {
    acc[league] = games;
    return acc;
  }, {});
}
