import { buildSection } from './stat-definitions.registry';

export const overallStatDefinitions = buildSection([
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

export const specialStatDefinitions = buildSection(['dutch200Count', 'varipapa300Count', 'allSparesGameCount']);

export const playFrequencyStatDefinitions = buildSection([
  'averageGamesPerWeek',
  'averageGamesPerMonth',
  'averageSessionsPerWeek',
  'averageSessionsPerMonth',
  'averageGamesPerSession',
]);

export const seriesStatDefinitions = buildSection([
  'average3SeriesScore',
  'high3Series',
  'average4SeriesScore',
  'high4Series',
  'average5SeriesScore',
  'high5Series',
  'average6SeriesScore',
  'high6Series',
]);

export const leagueStatDefinitions = buildSection(
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

export const throwStatDefinitions = buildSection([
  'totalStrikes',
  'averageStrikesPerGame',
  'totalSpares',
  'averageSparesPerGame',
  'totalSparesMissed',
  'averageOpensPerGame',
  'longestOpenStreak',
]);

export const strikeStatDefinitions = buildSection([
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

export const spareStatDefinitions = buildSection(['singlePinSpares', 'multiPinSpares', 'singlePinSparePercentage', 'multiPinSparePercentage']);

export const pinStatDefinitions = buildSection([
  'pocketHits',
  'pocketHitPercentage',
  'nonSplitSpares',
  'nonSplitSparePercentage',
  'splits',
  'splitConversionPercentage',
  'makeableSplits',
  'makeableSplitPercentage',
]);

export const sessionStatDefinitions = buildSection(
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
