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

/** A league night: all games a bowler played for a league on the same calendar day. */
export interface GameSession {
  /** Epoch ms normalized to local start-of-day. */
  date: number;
  games: Game[];
}

/** Normalizes an epoch timestamp to local start-of-day (used to bucket league nights). */
export function startOfLocalDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Groups games into chronological "sessions" (one per league night / calendar day),
 * sorted ascending. Shared by the migration and the season service so both produce the
 * same weekly-session bucketing.
 */
export function groupGamesIntoSessions(games: Game[]): GameSession[] {
  const byDay = new Map<number, Game[]>();
  for (const game of games) {
    const day = startOfLocalDay(game.date);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.push(game);
    } else {
      byDay.set(day, [game]);
    }
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([date, sessionGames]) => ({ date, games: sortGameHistoryByDate(sessionGames, true) }));
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
