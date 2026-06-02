import { buildSection } from './stat-definitions.registry';

export const OVERALL_STAT_DEFINITIONS = buildSection([
  'totalGames',
  'perfectGameCount',
  'cleanGameCount',
  'cleanGamePercentage',
  'averageScore',
  'highGame',
  'totalPins',
  'averageFirstCount',
  'markPercentage',
  'strikePercentage',
  'sparePercentage',
  'openPercentage',
]);

export const SPECIAL_STAT_DEFINITIONS = buildSection(['dutch200Count', 'varipapa300Count', 'allSparesGameCount']);

export const PLAY_FREQUENCY_STAT_DEFINITIONS = buildSection([
  'averageGamesPerWeek',
  'averageGamesPerMonth',
  'averageSessionsPerWeek',
  'averageSessionsPerMonth',
  'averageGamesPerSession',
]);

export const SERIES_STAT_DEFINITIONS = buildSection([
  'average3SeriesScore',
  'high3Series',
  'average4SeriesScore',
  'high4Series',
  'average5SeriesScore',
  'high5Series',
  'average6SeriesScore',
  'high6Series',
]);

export const LIVE_SERIES_STAT_DEFINTIONS = buildSection(
  [
    'totalGames',
    'averageScore',
    'highGame',
    'lowGame',
    'cleanGameCount',
    'averageFirstCount',
    'strikePercentage',
    'sparePercentage',
    'openPercentage',
    'markPercentage',
    'averageStrikesPerGame',
    'strikeToStrikePercentage',
    'longestStrikeStreak',
    'totalStrikes',
    'totalSpares',
    'totalSparesMissed',
  ],
  'live',
);

export const LEAGUE_STAT_DEFINITIONS = buildSection(
  [
    'totalGames',
    'perfectGameCount',
    'cleanGameCount',
    'cleanGamePercentage',
    'averageScore',
    'highGame',
    'totalPins',
    'averageFirstCount',
    'totalStrikes',
    'averageStrikesPerGame',
    'markPercentage',
    'strikePercentage',
    'totalSpares',
    'averageSparesPerGame',
    'sparePercentage',
    'totalSparesMissed',
    'averageOpensPerGame',
    'openPercentage',
  ],
  'league-',
);

export const THROW_STAT_DEFINITIONS = buildSection([
  'totalStrikes',
  'averageStrikesPerGame',
  'totalSpares',
  'averageSparesPerGame',
  'totalSparesMissed',
  'averageOpensPerGame',
  'longestOpenStreak',
]);

export const STRIKE_STAT_DEFINITIONS = buildSection([
  'turkeyCount',
  'bagger4Count',
  'bagger5Count',
  'bagger6Count',
  'bagger7Count',
  'bagger8Count',
  'bagger9Count',
  'bagger10Count',
  'bagger11Count',
  'longestStrikeStreak',
  'strikeToStrikePercentage',
  'strikeoutCount',
]);

export const SPARE_STAT_DEFINITIONS = buildSection(['singlePinSpares', 'multiPinSpares', 'singlePinSparePercentage', 'multiPinSparePercentage']);

export const PIN_STAT_DEFINITIONS = buildSection([
  'pocketHits',
  'pocketHitPercentage',
  'nonSplitSpares',
  'nonSplitSparePercentage',
  'splits',
  'splitConversionPercentage',
  'makeableSplits',
  'makeableSplitPercentage',
]);

export const SESSION_STAT_DEFINITIONS = buildSection(
  [
    'totalGames',
    'perfectGameCount',
    'cleanGameCount',
    'cleanGamePercentage',
    'averageScore',
    'highGame',
    'lowGame',
    'totalPins',
    'averageFirstCount',
    'totalStrikes',
    'averageStrikesPerGame',
    'strikePercentage',
    'totalSpares',
    'averageSparesPerGame',
    'sparePercentage',
    'totalSparesMissed',
    'averageOpensPerGame',
    'openPercentage',
  ],
  'session',
);
