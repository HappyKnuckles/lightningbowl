import { environment } from 'src/environments/environment';
import { Frame, Game } from '../../models/game.model';
import { HighlightItemStats } from '../../models/stats.model';

const DEFAULT_HIGHLIGHT: HighlightItemStats = {
  name: '',
  image: '',
  avg: 0,
  highestGame: 0,
  lowestGame: 0,
  gameCount: 0,
  cleanGameCount: 0,
  cleanRate: 0,
  strikeRate: 0,
};

/** Strikes thrown in a game, counting all three throws of the tenth frame. */
function countStrikes(frames: Frame[]): number {
  return frames.reduce((total, frame, index) => {
    if (index < 9) {
      return frame.throws[0]?.value === 10 ? total + 1 : total;
    }
    if (index === 9) {
      return total + frame.throws.filter((throwData) => throwData.value === 10).length;
    }
    return total;
  }, 0);
}

/**
 * Accumulates score stats per item over the games tagged with it. Balls, patterns
 * and alleys only differ in how a game names its items and where an image comes
 * from, so they share this accumulation.
 */
export function accumulateItemStats(
  gameHistory: Game[],
  getNames: (game: Game) => string[],
  getImage: (name: string) => string = () => '',
): Record<string, HighlightItemStats> {
  const tempStats: Record<
    string,
    { totalScore: number; gameCount: number; highestGame: number; lowestGame: number; cleanGames: number; totalStrikes: number }
  > = {};

  for (const game of gameHistory) {
    const names = new Set(getNames(game).filter((name) => !!name));
    if (names.size === 0) {
      continue;
    }

    const strikesInGame = countStrikes(game.frames);
    for (const name of names) {
      if (!tempStats[name]) {
        tempStats[name] = { totalScore: 0, gameCount: 0, highestGame: 0, lowestGame: 301, cleanGames: 0, totalStrikes: 0 };
      }
      const stats = tempStats[name];
      stats.totalScore += game.totalScore;
      stats.gameCount++;
      stats.totalStrikes += strikesInGame;
      stats.highestGame = Math.max(stats.highestGame, game.totalScore);
      stats.lowestGame = Math.min(stats.lowestGame, game.totalScore);
      if (game.isClean) {
        stats.cleanGames++;
      }
    }
  }

  const finalStats: Record<string, HighlightItemStats> = {};
  for (const name in tempStats) {
    const stats = tempStats[name];
    const totalPossibleStrikes = stats.gameCount * 12;
    finalStats[name] = {
      name,
      image: getImage(name),
      avg: stats.gameCount > 0 ? Math.round(stats.totalScore / stats.gameCount) : 0,
      highestGame: stats.highestGame,
      lowestGame: stats.lowestGame === 301 ? 0 : stats.lowestGame,
      gameCount: stats.gameCount,
      cleanGameCount: stats.cleanGames,
      cleanRate: stats.gameCount > 0 ? Math.round((stats.cleanGames / stats.gameCount) * 100) : 0,
      strikeRate: totalPossibleStrikes > 0 ? Math.round((stats.totalStrikes / totalPossibleStrikes) * 100) : 0,
    };
  }
  return finalStats;
}

/** Signed differential, e.g. "+8" / "-5" — the sign is the point of the stat. */
export function formatDifferential(differential: number | undefined): string {
  if (differential === undefined) {
    return '';
  }
  return differential > 0 ? `+${differential}` : `${differential}`;
}

export function pickTop(
  stats: Record<string, HighlightItemStats>,
  cmp: (a: HighlightItemStats, b: HighlightItemStats) => number,
): HighlightItemStats {
  const items = Object.values(stats);
  return items.length ? items.reduce((best, x) => (cmp(x, best) < 0 ? x : best)) : DEFAULT_HIGHLIGHT;
}

export function buildHighlights(src: {
  mostPlayedBall: HighlightItemStats;
  bestBall: HighlightItemStats;
  allBalls: HighlightItemStats[];
  mostPlayedPattern: HighlightItemStats;
  bestPattern: HighlightItemStats;
  allPatterns: HighlightItemStats[];
  mostPlayedAlley: HighlightItemStats;
  bestAlley: HighlightItemStats;
  allAlleys: HighlightItemStats[];
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
    {
      title: 'Most played alley',
      item: src.mostPlayedAlley,
      allItems: src.allAlleys,
      sortMode: 'gameCount' as const,
      emptyMessage: 'No Games with alleys saved.',
      imageUrlBase: undefined,
      roundImage: false,
    },
    {
      title: 'Best alley',
      item: src.bestAlley,
      allItems: src.allAlleys,
      sortMode: 'avg' as const,
      emptyMessage: 'No Games with alleys saved.',
      imageUrlBase: undefined,
      roundImage: false,
    },
  ];
}
