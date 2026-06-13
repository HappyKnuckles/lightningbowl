/**
 * Deterministic local-storage seed profiles.
 *
 *  - "rich"  → a realistic season of games across multiple leagues + a stocked
 *              arsenal + favourites. Drives history, stats, leagues, arsenal.
 *  - "empty" → nothing, for empty-state screenshots.
 *
 * Game scores/dates are fully fixed (computed from REFERENCE_NOW) so every
 * chart, average and "session" grouping is identical on every run.
 */
import type { Game } from '../../../src/app/core/models/game.model';
import type { SeedBundle } from '../lib/seed';
import type { SeedProfileName } from '../lib/types';
import { REFERENCE_NOW } from '../lib/constants';
import { StorageKeys } from '../../../src/app/core/services/storage/storage-keys';
import { buildGame, buildPinGame, op, sp, X, type GameMeta, type PinFrame } from '../lib/scoring';
import { BALLS, PATTERNS } from './remote';

const DAY = 86_400_000;
const STRIKE_THROW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TENTH_TURKEY: PinFrame = [STRIKE_THROW, STRIKE_THROW, STRIKE_THROW];
const TENTH_SPARE_FILL: PinFrame = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [10], STRIKE_THROW];

const ball = (i: number) => BALLS[i].ball_name;
const pattern = (i: number) => PATTERNS[i].title;

// ---- Non-pin frame templates (drive scores, charts, distributions) -------
// 10th frame has 3 throws only when the first two are a mark.
const TEMPLATES: number[][][] = [
  [[10], [10], [9, 1], [10], [8, 2], [10], [10], [7, 3], [10], [10, 10, 9]], // ~high
  [[9, 1], [8, 1], [10], [7, 3], [9, 0], [10], [8, 2], [9, 1], [7, 2], [9, 1, 8]], // good
  [[10], [9, 1], [8, 2], [10], [9, 1], [8, 2], [10], [9, 1], [8, 2], [9, 1, 10]], // clean
  [[8, 1], [7, 2], [9, 0], [8, 1], [10], [7, 2], [8, 1], [9, 0], [7, 2], [8, 1]], // average
  [
    [7, 2],
    [6, 2],
    [8, 1],
    [7, 1],
    [9, 0],
    [6, 3],
    [7, 2],
    [8, 0],
    [6, 2],
    [6, 2],
  ], // low
  [[10], [10], [8, 2], [10], [10], [9, 1], [10], [8, 2], [10], [10, 9, 1]], // strong
  [[9, 0], [8, 2], [7, 3], [9, 1], [8, 1], [10], [7, 2], [9, 1], [8, 2], [7, 3, 9]], // mid
];
const PERFECT: number[][] = [[10], [10], [10], [10], [10], [10], [10], [10], [10], [10, 10, 10]];

// ---- Pin-mode games (drive spare conversion, pin leaves, splits, pockets) -
const PIN_GAMES: PinFrame[][] = [
  [X(), sp([10]), sp([7]), X(), sp([3, 10]), op([4, 6, 7, 10]), X(), sp([2, 4, 5]), sp([6, 10]), TENTH_TURKEY],
  [sp([10]), X(), op([7]), sp([4]), X(), sp([3, 6, 10]), op([2, 4, 5, 8]), X(), sp([10]), TENTH_SPARE_FILL],
  [op([10]), sp([7]), X(), sp([2, 8]), op([4, 7, 10]), sp([3, 9]), X(), op([6]), sp([10]), TENTH_TURKEY],
];

interface Session {
  daysAgo: number;
  league?: string;
  isPractice?: boolean;
  templates: number[][][];
  pinGames?: PinFrame[][];
  balls: number[];
  patternIdx: number;
}

const SESSIONS: Session[] = [
  { daysAgo: 56, league: 'Monday Night League', templates: [TEMPLATES[3], TEMPLATES[1], TEMPLATES[2]], balls: [1, 0], patternIdx: 5 },
  { daysAgo: 49, league: 'Monday Night League', templates: [TEMPLATES[1], TEMPLATES[5], TEMPLATES[0]], balls: [0, 3], patternIdx: 5 },
  { daysAgo: 42, league: 'City Classic', templates: [TEMPLATES[2], TEMPLATES[3], TEMPLATES[6]], balls: [3, 4], patternIdx: 6 },
  { daysAgo: 35, league: 'Monday Night League', templates: [TEMPLATES[5], TEMPLATES[0], TEMPLATES[1]], balls: [0, 7], patternIdx: 1 },
  { daysAgo: 28, league: 'City Classic', templates: [TEMPLATES[6], TEMPLATES[2], TEMPLATES[3]], balls: [4, 8], patternIdx: 6 },
  { daysAgo: 21, league: 'Monday Night League', templates: [TEMPLATES[0], TEMPLATES[5], PERFECT], balls: [0, 3], patternIdx: 3 },
  { daysAgo: 14, league: 'City Classic', templates: [TEMPLATES[1], TEMPLATES[6], TEMPLATES[2]], balls: [3, 8], patternIdx: 2 },
  { daysAgo: 7, league: 'Monday Night League', templates: [TEMPLATES[5], TEMPLATES[0], TEMPLATES[1]], balls: [0, 7], patternIdx: 5 },
  { daysAgo: 3, isPractice: true, templates: [], pinGames: PIN_GAMES, balls: [0, 4], patternIdx: 4 },
  { daysAgo: 1, league: 'City Classic', templates: [TEMPLATES[6], TEMPLATES[1]], balls: [4, 3], patternIdx: 6 },
];

function buildGames(): Game[] {
  const games: Game[] = [];
  let gid = 1000;

  SESSIONS.forEach((session, sIdx) => {
    const date = REFERENCE_NOW - session.daysAgo * DAY + 19 * 3_600_000; // ~7pm local
    const seriesId = `series-${sIdx}`;
    const all = [...(session.templates ?? []), ...(session.pinGames ?? [])];
    const isSeries = all.length > 1;
    const balls = session.balls.map(ball);

    let withinSession = 0;
    const push = (game: Game) => {
      games.push(game);
      withinSession++;
    };

    (session.templates ?? []).forEach((frames, i) => {
      const meta: GameMeta = {
        gameId: String(gid++),
        date: date + withinSession * 1000,
        league: session.league,
        isPractice: !!session.isPractice,
        isSeries,
        seriesId: isSeries ? seriesId : undefined,
        balls,
        patterns: [pattern(session.patternIdx)],
        note: sIdx === 9 && i === 0 ? 'Fresh oil, played deeper after frame 4.' : undefined,
      };
      push(buildGame(frames, meta));
    });

    (session.pinGames ?? []).forEach((frames) => {
      const meta: GameMeta = {
        gameId: String(gid++),
        date: date + withinSession * 1000,
        isPractice: true,
        isSeries,
        seriesId: isSeries ? seriesId : undefined,
        balls,
        patterns: [pattern(session.patternIdx)],
      };
      push(buildPinGame(frames, meta));
    });
  });

  return games;
}

const LEAGUE_NAMES = ['Monday Night League', 'City Classic'];

function richBundle(): SeedBundle {
  const games = buildGames();
  const idb: [string, unknown][] = games.map((g) => [StorageKeys.game(g.gameId), g]);

  // League registry entries (used by the settings league selector / visibility).
  for (const name of LEAGUE_NAMES) idb.push([StorageKeys.league(name), name]);

  // Arsenal: five balls, ordered.
  const arsenalBalls = [0, 3, 5, 7, 11].map((i, pos) => ({ ...BALLS[i], position: pos + 1 }));
  for (const b of arsenalBalls) idb.push([StorageKeys.arsenal(b.ball_id, b.core_weight), b]);

  const local: Record<string, string> = {
    username: 'Nico',
    theme: 'Gray',
    'pin-input-mode': 'missing',
    pinInputMode: 'false',
    'first-game': String(REFERENCE_NOW - 60 * DAY),
    favoriteBalls: JSON.stringify([BALLS[0], BALLS[3]]),
    favoritePatterns: JSON.stringify([PATTERNS[0], PATTERNS[4]]),
  };

  return { idb, local };
}

function emptyBundle(): SeedBundle {
  return {
    idb: [],
    local: {
      username: 'Nico',
      theme: 'Gray',
      'pin-input-mode': 'missing',
      pinInputMode: 'false',
    },
  };
}

const PROFILES: Record<SeedProfileName, () => SeedBundle> = {
  rich: richBundle,
  empty: emptyBundle,
};

export function getSeedBundle(profile: SeedProfileName): SeedBundle {
  return PROFILES[profile]();
}
