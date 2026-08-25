type StatValue = number | number[] | string;

export interface Stats {
  [key: string]: StatValue | undefined;
  allSparesGameCount?: number;
  average3SeriesScore?: number;
  average4SeriesScore?: number;
  average5SeriesScore?: number;
  average6SeriesScore?: number;
  averageFirstCount: number;
  averageGamesPerMonth?: number;
  averageGamesPerSession?: number;
  averageGamesPerWeek?: number;
  averageGamesPerYear?: number;
  averageOpensPerGame: number;
  averageScore: number;
  averageSessionsPerMonth?: number;
  averageSessionsPerWeek?: number;
  averageSparesPerGame: number;
  averageStrikesPerGame: number;
  bagger4Count?: number;
  bagger5Count?: number;
  bagger6Count?: number;
  bagger7Count?: number;
  bagger8Count?: number;
  bagger9Count?: number;
  bagger10Count?: number;
  bagger11Count?: number;
  cleanGameCount: number;
  cleanGamePercentage: number;
  dutch200Count?: number;
  high3Series?: number;
  high4Series?: number;
  high5Series?: number;
  high6Series?: number;
  highGame: number;
  longesStrikeStreak?: number;
  longestOpenStreak?: number;
  lowGame: number;
  makeableSplitOpportunities?: number;
  makeableSplitPercentage?: number;
  makeableSplits?: number;
  markPercentage: number;
  missedCounts: number[];
  multiPinSpareOpportunities?: number;
  multiPinSparePercentage?: number;
  multiPinSpares?: number;
  nonSplitSpareOpportunities?: number;
  nonSplitSparePercentage?: number;
  nonSplitSpares?: number;
  openPercentage: number;
  overallMissedRate: number;
  overallSpareRate: number;
  perfectGameCount: number;
  pinCounts: number[];
  pocketHitPercentage?: number;
  // Pin-specific stats (only calculated if isPinMode is true)
  // TODO add most left/hit single/multi pins stats and maybe add a separate PinStats interface
  pocketHits?: number;
  singlePinSpareOpportunities?: number;
  singlePinSparePercentage?: number;
  singlePinSpares?: number;
  sparePercentage: number;
  spareRates: number[];
  splitConversionPercentage?: number;
  splitOpportunities?: number;
  splits?: number;
  strikeoutCount?: number;
  strikePercentage: number;
  strikeToStrikePercentage?: number;
  totalFirstBalls?: number;
  totalGames: number;
  totalPins: number;
  totalSpares: number;
  totalSparesConverted: number;
  totalSparesMissed: number;
  totalStrikes: number;
  turkeyCount?: number;
  varipapa300Count?: number;
}

// TODO think of what these need
export interface SeriesStats extends Stats {
  seriesDate: string;
  seriesTotal: number;
}

export interface LiveSeriesStats {
  allLeaves: LeaveStats[];
  context: { complete: number; total: number };
  leaves: { best: LeaveStats[]; common: LeaveStats[]; worst: LeaveStats[] };
  stats: Stats;
}

export interface OverallSeriesStats {
  averageOpensPerSeries: number;
  averageSeriesScore: number;
  averageSparesPerSeries: number;
  averageSrtrikesPerSeries: number;
  highSeries: number;
  lowSeries: number;
  seriesCount: number;
}

export interface PrevStats {
  [key: string]: StatValue | undefined;
  average3SeriesScore?: number;
  average4SeriesScore?: number;
  average5SeriesScore?: number;
  averageFirstCount: number;
  averageOpensPerGame: number;
  averageScore: number;
  averageSparesPerGame: number;
  averageStrikesPerGame: number;
  cleanGameCount: number;
  cleanGamePercentage: number;
  high3Series?: number;
  high4Series?: number;
  makeableSplitPercentage?: number;
  markPercentage: number;
  multiPinSparePercentage?: number;
  nonSplitSparePercentage?: number;
  openPercentage: number;
  overallMissedRate: number;
  overallSpareRate: number;
  perfectGameCount: number;
  pocketHitPercentage?: number;
  singlePinSparePercentage?: number;
  sparePercentage: number;
  spareRates: number[];
  splitConversionPercentage?: number;
  strikePercentage: number;
  strikeToStrikePercentage?: number;
}

export interface HighlightItemStats {
  avg: number;
  cleanGameCount?: number;
  gameCount: number;
  highestGame: number;
  image: string;
  lowestGame: number;
  name: string;
  strikeRate?: number;
}

export interface LeaveStats {
  occurrences: number;
  pickupPercentage: number;
  pickups: number;
  pins: number[];
}

export interface LeagueLeaveStats {
  all: LeaveStats[];
  best: LeaveStats[];
  common: LeaveStats[];
  worst: LeaveStats[];
}

export type GameStats = Stats | SeriesStats | PrevStats;
