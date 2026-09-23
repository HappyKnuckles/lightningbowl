import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game, Throw, ThrowBall } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { Stats } from 'src/app/core/models/stats.model';

/** Ten empty frames, the shape every game starts from. */
export function makeFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, frameIndex) => ({ frameIndex, throws: [] }));
}

/** Minimal valid `Game`. Override any field via `overrides`. */
export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    gameId: 'game-1',
    date: Date.UTC(2026, 0, 1),
    frames: makeFrames(),
    totalScore: 0,
    frameScores: Array(10).fill(0),
    isClean: false,
    isPerfect: false,
    isPractice: false,
    isPinMode: false,
    patterns: [],
    ...overrides,
  };
}

/**
 * Minimal valid `Stats`, everything zeroed. Override any field via `overrides`.
 *
 * `pinCounts`, `missedCounts` and `spareRates` are 1-based (index 0 is unused),
 * so they carry eleven entries the way the stat calculators emit them.
 */
export function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    totalGames: 0,
    totalPins: 0,
    perfectGameCount: 0,
    cleanGameCount: 0,
    cleanGamePercentage: 0,
    totalStrikes: 0,
    totalSpares: 0,
    totalSparesMissed: 0,
    totalSparesConverted: 0,
    pinCounts: Array(11).fill(0),
    missedCounts: Array(11).fill(0),
    averageStrikesPerGame: 0,
    averageSparesPerGame: 0,
    averageOpensPerGame: 0,
    markPercentage: 0,
    strikePercentage: 0,
    sparePercentage: 0,
    openPercentage: 0,
    averageFirstCount: 0,
    averageScore: 0,
    highGame: 0,
    lowGame: 0,
    spareRates: Array(11).fill(0),
    overallSpareRate: 0,
    overallMissedRate: 0,
    ...overrides,
  };
}

/** Minimal valid `Pattern`. Override any field via `overrides`. */
export function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    url: '',
    title: 'Test Pattern',
    category: 'Sport',
    distance: '39',
    ratio: '5:1',
    volume: '25',
    forward: '',
    reverse: '',
    pump: '',
    pdf_url: '',
    kosi_url: '',
    forwards_data: [],
    reverse_data: [],
    chart_standard: '',
    chart_horizontal: '',
    ...overrides,
  };
}

/** Minimal valid `Ball`. Override any field via `overrides`. */
export function makeBall(overrides: Partial<Ball> = {}): Ball {
  return {
    availability: 'Available',
    ball_id: 'ball-1',
    ball_image: '',
    ball_name: 'Test Ball',
    brand_id: 'brand-1',
    brand_name: 'Test Brand',
    core_diff: '0.045',
    core_id: 'core-1',
    core_image: '',
    core_int_diff: '0',
    core_name: 'Test Core',
    core_rg: '2.5',
    core_type: 'Symmetric',
    core_weight: '15',
    coverstock_id: 'cover-1',
    coverstock_name: 'Test Coverstock',
    coverstock_type: 'Reactive',
    factory_finish: '500 Siaair',
    last_update: '',
    release_date: '2025',
    thumbnail_image: '',
    us_int: 'US',
    ...overrides,
  };
}

/**
 * A throw with pin data, as pin input mode records it.
 * `pinsLeft` are the pins still standing afterwards, so `value` is derived from the
 * pins available before it, so pass `available` when the throw is at a leave.
 */
export function makeThrow(
  throwIndex: number,
  pinsLeft: number[],
  options: { ball?: ThrowBall; available?: number[]; isSplit?: boolean } = {},
): Throw {
  const available = options.available ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return {
    value: available.length - pinsLeft.length,
    throwIndex: throwIndex + 1,
    pinsLeftStanding: pinsLeft,
    pinsKnockedDown: available.filter((pin) => !pinsLeft.includes(pin)),
    isSplit: options.isSplit,
    ball: options.ball,
  };
}

/** A frame built from throws, indexed the way the calculators expect. */
export function makeFrame(frameIndex: number, throws: Throw[]): Frame {
  return { frameIndex, throws };
}
