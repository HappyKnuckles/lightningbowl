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
  /** Share of games finished without an open frame, 0-100. */
  cleanRate?: number;
  /**
   * Alley-only extras. A ball or pattern is something you carry between houses,
   * so these only carry meaning for a venue: how it compares to your baseline,
   * how often you actually go, and whether you still play there.
   */
  /** Average here minus the overall average of the same game set. */
  differential?: number;
  /** Distinct days played here — an alley visit, not a single game. */
  visitCount?: number;
  /** Timestamp of the most recent game played here. */
  lastPlayed?: number;
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

export type GameStats = Stats | SeriesStats | PrevStats;
