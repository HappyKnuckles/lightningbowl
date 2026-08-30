type StatValue = number | number[] | string;

export interface Stats {
  totalGames: number;
  totalPins: number;
  perfectGameCount: number;
  cleanGameCount: number;
  cleanGamePercentage: number;
  totalStrikes: number;
  totalSpares: number;
  totalSparesMissed: number;
  totalSparesConverted: number;
  pinCounts: number[];
  missedCounts: number[];
  averageStrikesPerGame: number;
  averageSparesPerGame: number;
  averageOpensPerGame: number;
  markPercentage: number;
  strikePercentage: number;
  sparePercentage: number;
  openPercentage: number;
  averageFirstCount: number;
  averageScore: number;
  highGame: number;
  lowGame: number;
  spareRates: number[];
  overallSpareRate: number;
  overallMissedRate: number;
  longesStrikeStreak?: number;
  longestOpenStreak?: number;
  dutch200Count?: number;
  varipapa300Count?: number;
  averageGamesPerSession?: number;
  averageSessionsPerWeek?: number;
  averageSessionsPerMonth?: number;
  strikeoutCount?: number;
  strikeToStrikePercentage?: number;
  turkeyCount?: number;
  bagger4Count?: number;
  bagger5Count?: number;
  bagger6Count?: number;
  bagger7Count?: number;
  bagger8Count?: number;
  bagger9Count?: number;
  bagger10Count?: number;
  bagger11Count?: number;
  allSparesGameCount?: number;
  averageGamesPerMonth?: number;
  averageGamesPerWeek?: number;
  averageGamesPerYear?: number;
  average3SeriesScore?: number;
  high3Series?: number;
  average4SeriesScore?: number;
  high4Series?: number;
  average5SeriesScore?: number;
  high5Series?: number;
  average6SeriesScore?: number;
  high6Series?: number;
  // Pin-specific stats (only calculated if isPinMode is true)
  // TODO add most left/hit single/multi pins stats and maybe add a separate PinStats interface
  pocketHits?: number;
  totalFirstBalls?: number;
  pocketHitPercentage?: number;
  singlePinSpares?: number;
  singlePinSpareOpportunities?: number;
  multiPinSpares?: number;
  multiPinSpareOpportunities?: number;
  nonSplitSpares?: number;
  nonSplitSpareOpportunities?: number;
  splits?: number;
  splitOpportunities?: number;
  singlePinSparePercentage?: number;
  multiPinSparePercentage?: number;
  nonSplitSparePercentage?: number;
  splitConversionPercentage?: number;
  makeableSplits?: number;
  makeableSplitOpportunities?: number;
  makeableSplitPercentage?: number;
  [key: string]: StatValue | undefined;
}

// TODO think of what these need
export interface SeriesStats extends Stats {
  seriesTotal: number;
  seriesDate: string;
}

export interface LiveSeriesStats {
  stats: Stats;
  leaves: { best: LeaveStats[]; worst: LeaveStats[]; common: LeaveStats[] };
  allLeaves: LeaveStats[];
  context: { complete: number; total: number };
}

export interface OverallSeriesStats {
  seriesCount: number;
  averageSeriesScore: number;
  averageSrtrikesPerSeries: number;
  averageSparesPerSeries: number;
  averageOpensPerSeries: number;
  highSeries: number;
  lowSeries: number;
}

export interface PrevStats {
  cleanGamePercentage: number;
  markPercentage: number;
  strikePercentage: number;
  sparePercentage: number;
  openPercentage: number;
  averageStrikesPerGame: number;
  averageSparesPerGame: number;
  averageOpensPerGame: number;
  averageFirstCount: number;
  cleanGameCount: number;
  perfectGameCount: number;
  averageScore: number;
  strikeToStrikePercentage?: number;
  overallSpareRate: number;
  overallMissedRate: number;
  spareRates: number[];
  pocketHitPercentage?: number;
  singlePinSparePercentage?: number;
  multiPinSparePercentage?: number;
  nonSplitSparePercentage?: number;
  splitConversionPercentage?: number;
  makeableSplitPercentage?: number;
  average3SeriesScore?: number;
  high3Series?: number;
  average4SeriesScore?: number;
  high4Series?: number;
  average5SeriesScore?: number;
  [key: string]: StatValue | undefined;
}

export interface HighlightItemStats {
  name: string;
  image: string;
  avg: number;
  highestGame: number;
  lowestGame: number;
  gameCount: number;
  strikeRate?: number;
  cleanGameCount?: number;
}

export interface LeaveStats {
  pins: number[];
  occurrences: number;
  pickups: number;
  pickupPercentage: number;
}

export interface LeagueLeaveStats {
  all: LeaveStats[];
  common: LeaveStats[];
  best: LeaveStats[];
  worst: LeaveStats[];
}

export type GameStats = Stats | SeriesStats | PrevStats | BallDetailStats;

/**
 * How much a ball's numbers can be trusted to describe the ball itself.
 * - `basic`: game-level data only. The ball was picked once for the game, so every
 *   number describes the games it appeared in, not the throws it made.
 * - `detailed`: per-throw data. Every number is attributed to actual throws.
 */
export type BallStatTier = 'basic' | 'detailed';

/** Conversion rate on one specific single pin, with one specific ball. */
export interface PinConversionStats {
  pin: number;
  occurrences: number;
  pickups: number;
  pickupPercentage: number;
}

/** One ball's first-ball performance on one oil pattern. */
export interface BallPatternStats {
  pattern: string;
  firstBalls: number;
  strikePercentage: number;
  carryPercentage: number;
  averageFrameValue: number;
}

/** Per-throw derived stats. Only produced from games tracked per throw. */
export interface BallDetailStats {
  // Usage / role
  throws: number;
  firstBalls: number;
  spareBalls: number;
  /** Share of all tracked throws in the current selection, 0-100. */
  throwShare: number;

  // First ball quality
  strikes: number;
  strikePercentage: number;
  pocketHits: number;
  pocketPercentage: number;
  /** Strikes as a share of pocket hits: carry, isolated from accuracy. */
  carryPercentage: number;
  firstBallAverage: number;
  splits: number;
  splitPercentage: number;
  openFrames: number;
  openFramePercentage: number;
  longestStrikeStreak: number;

  // Leave signature (share of first balls)
  cornerPinLeaves: number;
  cornerPinPercentage: number;
  flatCornerLeaves: number;
  flatCornerPercentage: number;
  solidLeaves: number;
  solidPercentage: number;
  washouts: number;
  washoutPercentage: number;
  lightLeaves: number;
  lightPercentage: number;
  highLeaves: number;
  highPercentage: number;

  // Spare shooting
  spareAttempts: number;
  sparesConverted: number;
  spareConversionPercentage: number;
  singlePinAttempts: number;
  singlePinConverted: number;
  singlePinPercentage: number;
  multiPinAttempts: number;
  multiPinConverted: number;
  multiPinPercentage: number;
  splitAttempts: number;
  splitConverted: number;
  splitConversionPercentage: number;
  makeableSplitAttempts: number;
  makeableSplitConverted: number;
  makeableSplitPercentage: number;
  /** Average pins left standing after a missed spare, showing how badly the misses miss. */
  averageMissMargin: number;

  // Frame-attributed scoring
  framesLed: number;
  averageFrameValue: number;
  /** `averageFrameValue` × 10, an estimate comparable to a game average. */
  projectedAverage: number;
  marks: number;
  markPercentage: number;

  // Breakdowns
  pinConversions: PinConversionStats[];
  leaves: LeaveStats[];
  patternBreakdown: BallPatternStats[];

  [key: string]: StatValue | PinConversionStats[] | LeaveStats[] | BallPatternStats[] | undefined;
}

/**
 * Everything measurable about one ball. The game-level fields are always present;
 * `detail` needs per-throw tracking and is undefined without it.
 */
export interface BallStats {
  /** Ball key: "Name{weight}", the same key `Game.balls` uses. */
  key: string;
  name: string;
  displayName: string;
  weight?: string;
  image: string;
  tier: BallStatTier;

  gameCount: number;
  /** Games among those that carried per-throw data. 0 for a basic-tier ball. */
  detailedGameCount: number;
  avg: number;
  highestGame: number;
  lowestGame: number;
  cleanGameCount: number;
  lastUsed: number;

  detail?: BallDetailStats;
}

/** Denominators below which a rate is too noisy to show. */
export const BALL_STAT_MIN_SAMPLES = {
  firstBall: 12,
  pocket: 8,
  spareAttempt: 8,
  leave: 5,
  frame: 20,
} as const;
