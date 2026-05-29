import { StatDefinition } from 'src/app/core/models/stat-definitions.model';

export const overallStatDefinitions: StatDefinition[] = [
  { label: 'Games', key: 'totalGames', id: 'totalGames' },
  {
    label: 'Perfect games',
    key: 'perfectGameCount',
    id: 'perfectGameCount',
    toolTip: 'A perfect game means every frame is filled with strikes.',
    prevKey: 'perfectGameCount',
  },
  {
    label: 'Clean games',
    key: 'cleanGameCount',
    id: 'cleanGameCount',
    toolTip: 'A clean game means every frame is filled with either a strike or a spare.',
    prevKey: 'cleanGameCount',
  },
  {
    label: 'Clean game percentage',
    key: 'cleanGamePercentage',
    id: 'cleanGamePercentage',
    isPercentage: true,
    toolTip: 'The percentage of how many games were clean games.',
    prevKey: 'cleanGamePercentage',
  },
  { label: 'Average', key: 'averageScore', id: 'averageScore', prevKey: 'averageScore' },
  { label: 'High game', key: 'highGame', id: 'highGame' },
  { label: 'Total pins', key: 'totalPins', id: 'totalPins' },
  { label: 'First ball average', key: 'averageFirstCount', id: 'averageFirstCount', prevKey: 'averageFirstCount' },
  {
    label: 'Mark-percentage',
    key: 'markPercentage',
    id: 'markPercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you had any kind of non open.',
    prevKey: 'markPercentage',
  },
  {
    label: 'Strike-percentage',
    key: 'strikePercentage',
    id: 'strikePercentage',
    isPercentage: true,
    toolTip: 'This is the strike probability, calculated as the percentage of strikes you achieve out of a maximum of 12 per game.',
    prevKey: 'strikePercentage',
  },
  {
    label: 'Spare-percentage',
    key: 'overallSpareRate',
    id: 'sparePercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you hit a spare if your first throw was not a strike.',
    prevKey: 'overallSpareRate',
  },
  {
    label: 'Open-percentage',
    key: 'overallMissedRate',
    id: 'openPercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you miss a spare if your first throw was not a strike.',
    prevKey: 'overallMissedRate',
  },
];

export const specialStatDefinitions: StatDefinition[] = [
  {
    label: 'Dutch 200s',
    key: 'dutch200Count',
    id: 'dutch200Count',
    toolTip: 'This is the amount of games you bowled with a score of 200, where you had alternating strikes and spares.',
  },
  {
    label: 'Varipapa 300s',
    key: 'varipapa300Count',
    id: 'varipapa300Count',
    toolTip: 'These are 300 games where you bowled 12 consecutive strikes over two games.',
  },
  {
    label: 'Full spare games',
    key: 'allSparesGameCount',
    id: 'allSparesGameCount',
    toolTip: 'This is the amount of games where you bowled all spares.',
  },
];

export const playFrequencyStatDefinitions: StatDefinition[] = [
  {
    label: 'Average games per week',
    key: 'averageGamesPerWeek',
    id: 'averageGamesPerWeek',
  },
  {
    label: 'Average games per month',
    key: 'averageGamesPerMonth',
    id: 'averageGamesPerMonth',
  },
  {
    label: 'Average sessions per week',
    key: 'averageSessionsPerWeek',
    id: 'averageSessionsPerWeek',
    toolTip: 'This is how often you usually bowl in a week.',
  },
  {
    label: 'Average sessions per month',
    key: 'averageSessionsPerMonth',
    id: 'averageSessionsPerMonth',
    toolTip: 'This is how often you usually bowl in a month.',
  },
  {
    label: 'Average games per session',
    key: 'averageGamesPerSession',
    id: 'averageGamesPerSession',
    toolTip: 'This is the amount of games you bowl on average in a session.',
  },
];

export const seriesStatDefinitions: StatDefinition[] = [
  { label: 'Average 3-series score', key: 'average3SeriesScore', id: 'average3SeriesScore', prevKey: 'average3SeriesScore' },
  { label: 'High 3-series', key: 'high3Series', id: 'high3Series' },
  { label: 'Average 4-series score', key: 'average4SeriesScore', id: 'average4SeriesScore', prevKey: 'average4SeriesScore' },
  { label: 'High 4-series', key: 'high4Series', id: 'high4Series' },
  { label: 'Average 5-series score', key: 'average5SeriesScore', id: 'average5SeriesScore', prevKey: 'average5SeriesScore' },
  { label: 'High 5-series', key: 'high5Series', id: 'high5Series' },
  { label: 'Average 6-series score', key: 'average6SeriesScore', id: 'average6SeriesScore', prevKey: 'average6SeriesScore' },
  { label: 'High 6-series', key: 'high6Series', id: 'high6Series' },
];

export const leagueStatDefinitions: StatDefinition[] = [
  { label: 'Games', key: 'totalGames', id: 'league-totalGames' },
  {
    label: 'Perfect games',
    key: 'perfectGameCount',
    id: 'league-perfectGameCount',
    toolTip: 'A perfect game means every frame is filled with strikes.',
  },
  {
    label: 'Clean games',
    key: 'cleanGameCount',
    id: 'league-cleanGameCount',
    toolTip: 'A clean game means every frame is filled with either a strike or a spare.',
  },
  {
    label: 'Clean game percentage',
    key: 'cleanGamePercentage',
    id: 'league-cleanGamePercentage',
    isPercentage: true,
    toolTip: 'The percentage of how many games were clean games.',
    prevKey: 'cleanGamePercentage',
  },
  { label: 'Average', key: 'averageScore', id: 'league-averageScore', prevKey: 'averageScore' },
  { label: 'High game', key: 'highGame', id: 'league-highGame' },
  { label: 'Total pins', key: 'totalPins', id: 'league-totalPins' },
  { label: 'First ball average', key: 'averageFirstCount', id: 'league-averageFirstCount', prevKey: 'averageFirstCount' },
  { label: 'Total strikes', key: 'totalStrikes', id: 'league-totalStrikes' },
  { label: 'Strikes per game', key: 'averageStrikesPerGame', id: 'league-averageStrikesPerGame', prevKey: 'averageStrikesPerGame' },
  { label: 'Mark-percentage', key: 'markPercentage', id: 'league-markPercentage', isPercentage: true, prevKey: 'markPercentage' },
  {
    label: 'Strike-percentage',
    key: 'strikePercentage',
    id: 'league-strikePercentage',
    isPercentage: true,
    toolTip: 'This shows your strike probability, calculated as the percentage of strikes you achieve out of a maximum of 12 per game.',
    prevKey: 'strikePercentage',
  },
  { label: 'Total spares', key: 'totalSpares', id: 'league-totalSpares' },
  { label: 'Spares per game', key: 'averageSparesPerGame', id: 'league-averageSparesPerGame', prevKey: 'averageSparesPerGame' },
  {
    label: 'Spare-percentage',
    key: 'overallSpareRate',
    id: 'league-sparePercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you hit a spare if your first throw was not a strike.',
    prevKey: 'overallSpareRate',
  },
  { label: 'Total opens', key: 'totalSparesMissed', id: 'league-totalSparesMissed' },
  { label: 'Opens per game', key: 'averageOpensPerGame', id: 'league-averageOpensPerGame', prevKey: 'averageOpensPerGame' },
  {
    label: 'Open-percentage',
    key: 'overallMissedRate',
    id: 'league-openPercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you miss a spare if your first throw was not a strike.',
    prevKey: 'overallMissedRate',
  },
];

export const throwStatDefinitions: StatDefinition[] = [
  { label: 'Total strikes', key: 'totalStrikes', id: 'totalStrikes' },
  { label: 'Strikes per game', key: 'averageStrikesPerGame', id: 'averageStrikesPerGame', prevKey: 'averageStrikesPerGame' },
  { label: 'Total spares', key: 'totalSpares', id: 'totalSpares' },
  { label: 'Spares per game', key: 'averageSparesPerGame', id: 'averageSparesPerGame', prevKey: 'averageSparesPerGame' },
  { label: 'Total opens', key: 'totalSparesMissed', id: 'totalSparesMissed' },
  { label: 'Opens per game', key: 'averageOpensPerGame', id: 'averageOpensPerGame', prevKey: 'averageOpensPerGame' },
  {
    label: 'Longest open streak',
    key: 'longestOpenStreak',
    id: 'longestOpenStreak',
    toolTip: 'Longest run of frames without a strike or spare (an “open”).',
  },
];

export const strikeStatDefinitions: StatDefinition[] = [
  { label: 'Turkeys', key: 'turkeyCount', id: 'turkeyCount', toolTip: 'Number of times you threw exactly 3 strikes in a row.' },
  { label: '4-baggers', key: 'bagger4Count', id: 'bagger4Count', toolTip: 'Number of times you threw exactly 4 strikes in a row.' },
  { label: '5-baggers', key: 'bagger5Count', id: 'bagger5Count', toolTip: 'Number of times you threw exactly 5 strikes in a row.' },
  { label: '6-baggers', key: 'bagger6Count', id: 'bagger6Count', toolTip: 'Number of times you threw exactly 6 strikes in a row.' },
  { label: '7-baggers', key: 'bagger7Count', id: 'bagger7Count', toolTip: 'Number of times you threw exactly 7 strikes in a row.' },
  { label: '8-baggers', key: 'bagger8Count', id: 'bagger8Count', toolTip: 'Number of times you threw exactly 8 strikes in a row.' },
  { label: '9-baggers', key: 'bagger9Count', id: 'bagger9Count', toolTip: 'Number of times you threw exactly 9 strikes in a row.' },
  { label: '10-baggers', key: 'bagger10Count', id: 'bagger10Count', toolTip: 'Number of times you threw exactly 10 strikes in a row.' },
  { label: '11-baggers', key: 'bagger11Count', id: 'bagger11Count', toolTip: 'Number of times you threw exactly 11 strikes in a row.' },
  {
    label: 'Longest strike streak',
    key: 'longestStrikeStreak',
    id: 'longestStrikeStreak',
    toolTip: 'This is the amount of consecutive strikes you bowled in a row. It is considered over multiple games on the same day.',
  },
  {
    label: 'Strike to strike percentage',
    key: 'strikeToStrikePercentage',
    prevKey: 'strikeToStrikePercentage',
    id: 'strikeToStrikePercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you throw a strike after a strike.',
  },
  {
    label: 'Strikeouts',
    key: 'strikeoutCount',
    id: 'strikeoutCount',
    toolTip: 'This is the amount of times you threw 3-strikes in tenth frame.',
  },
];

export const spareStatDefinitions: StatDefinition[] = [
  {
    label: 'Single pin spares',
    key: 'singlePinSpares',
    id: 'singlePinSpares',
    secondaryKey: 'singlePinSpareOpportunities',
    toolTip: 'Number of spares made when only one pin was left standing after the first ball.',
  },
  {
    label: 'Multi pin spares',
    key: 'multiPinSpares',
    id: 'multiPinSpares',
    secondaryKey: 'multiPinSpareOpportunities',
    toolTip: 'Number of spares made when multiple pins were left standing after the first ball.',
  },
  {
    label: 'Single pin spare %',
    key: 'singlePinSparePercentage',

    id: 'singlePinSparePercentage',
    isPercentage: true,
    prevKey: 'singlePinSparePercentage',
  },
  {
    label: 'Multi pin spare %',
    key: 'multiPinSparePercentage',
    id: 'multiPinSparePercentage',
    isPercentage: true,
    prevKey: 'multiPinSparePercentage',
  },
];

export const pinStatDefinitions: StatDefinition[] = [
  {
    label: 'Pocket hits',
    key: 'pocketHits',
    id: 'pocketHits',
    secondaryKey: 'totalFirstBalls',
    toolTip: 'Number of times you hit the pocket on the first ball (knocked down at least pins 1 and 2, or 1 and 3).',
  },
  {
    label: 'Pocket hit %',
    key: 'pocketHitPercentage',
    id: 'pocketHitPercentage',
    isPercentage: true,
    prevKey: 'pocketHitPercentage',
    toolTip: 'Percentage of first balls where you hit the pocket.',
  },
  {
    label: 'Non-split spares',
    key: 'nonSplitSpares',
    id: 'nonSplitSpares',
    secondaryKey: 'nonSplitSpareOpportunities',
  },
  {
    label: 'Non-split spare %',
    key: 'nonSplitSparePercentage',
    id: 'nonSplitSparePercentage',
    isPercentage: true,
    prevKey: 'nonSplitSparePercentage',
  },
  {
    label: 'Split conversions',
    key: 'splits',
    id: 'splits',
    secondaryKey: 'splitOpportunities',
  },
  {
    label: 'Split conversion %',
    key: 'splitConversionPercentage',
    id: 'splitConversionPercentage',
    isPercentage: true,
    prevKey: 'splitConversionPercentage',
  },
  {
    label: 'Makeable split conversions',
    key: 'makeableSplits',
    id: 'makeableSplits',
    secondaryKey: 'makeableSplitOpportunities',
    toolTip: 'Number of makeable splits converted (excludes impossible splits like 7-10, 4-6, etc.).',
  },
  {
    label: 'Makeable split %',
    key: 'makeableSplitPercentage',
    prevKey: 'makeableSplitPercentage',
    id: 'makeableSplitPercentage',
    isPercentage: true,
    toolTip: 'Percentage of makeable splits that were successfully converted.',
  },
];

export const liveSeriesStatDefinitions: StatDefinition[] = [
  // Game-level: only from fully complete games
  { label: 'Complete games', key: 'totalGames', id: 'live-totalGames' },
  { label: 'Average', key: 'averageScore', id: 'live-averageScore' },
  { label: 'High game', key: 'highGame', id: 'live-highGame' },
  {
    label: 'Clean games',
    key: 'cleanGameCount',
    id: 'live-cleanGameCount',
    toolTip: 'A clean game means every frame is filled with either a strike or a spare.',
  },
  // Frame-level: computed from all completed frames across all games
  { label: 'First ball average', key: 'averageFirstCount', id: 'live-averageFirstCount' },
  { label: 'Strike %', key: 'strikePercentage', id: 'live-strikePercentage', isPercentage: true },
  { label: 'Spare %', key: 'overallSpareRate', id: 'live-sparePercentage', isPercentage: true },
  { label: 'Open %', key: 'overallMissedRate', id: 'live-openPercentage', isPercentage: true },
  { label: 'Mark %', key: 'markPercentage', id: 'live-markPercentage', isPercentage: true },
  { label: 'Strikes per game', key: 'averageStrikesPerGame', id: 'live-averageStrikesPerGame' },
  { label: 'Strike to strike %', key: 'strikeToStrikePercentage', id: 'live-strikeToStrikePercentage', isPercentage: true },
  { label: 'Longest strike streak', key: 'longestStrikeStreak', id: 'live-longestStrikeStreak' },
  { label: 'Total strikes', key: 'totalStrikes', id: 'live-totalStrikes' },
  { label: 'Total spares', key: 'totalSpares', id: 'live-totalSpares' },
  { label: 'Total opens', key: 'totalSparesMissed', id: 'live-totalSparesMissed' },
];

export const sessionStatDefinitions: StatDefinition[] = [
  { label: 'Games', key: 'totalGames', id: 'sessionTotalGames' },
  {
    label: 'Perfect games',
    key: 'perfectGameCount',
    id: 'sessionPerfectGameCount',
    toolTip: 'A perfect game means every frame is filled with strikes.',
  },
  {
    label: 'Clean games',
    key: 'cleanGameCount',
    id: 'sessionCleanGameCount',
    toolTip: 'A clean game means every frame is filled with either a strike or a spare.',
  },
  {
    label: 'Clean game percentage',
    key: 'cleanGamePercentage',
    id: 'sessionCleanGamePercentage',
    isPercentage: true,
    toolTip: 'The percentage of how many games were clean games.',
    prevKey: 'cleanGamePercentage',
  },
  { label: 'Average', key: 'averageScore', id: 'sessionAverage', prevKey: 'averageScore' },
  { label: 'High game', key: 'highGame', id: 'sessionHighGame' },
  { label: 'Low game', key: 'lowGame', id: 'sessionLowGame' },
  { label: 'Total pins', key: 'totalPins', id: 'sessionTotalPins' },
  { label: 'First ball average', key: 'averageFirstCount', id: 'sessionAverageFirstCount', prevKey: 'averageFirstCount' },
  { label: 'Total strikes', key: 'totalStrikes', id: 'sessionTotalStrikes' },
  { label: 'Strikes per game', key: 'averageStrikesPerGame', id: 'sessionAverageStrikesPerGame', prevKey: 'averageStrikesPerGame' },
  {
    label: 'Strike-percentage',
    key: 'strikePercentage',
    id: 'sessionStrikePercentage',
    isPercentage: true,
    toolTip: 'This shows your strike probability, calculated as the percentage of strikes you achieve out of a maximum of 12 per game.',
    prevKey: 'strikePercentage',
  },
  { label: 'Total spares', key: 'totalSpares', id: 'sessionTotalSpares' },
  { label: 'Spares per game', key: 'averageSparesPerGame', id: 'sessionAverageSparesPerGame', prevKey: 'averageSparesPerGame' },
  {
    label: 'Spare-percentage',
    key: 'overallSpareRate',
    id: 'sessionSparePercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you hit a spare if your first throw was not a strike.',
    prevKey: 'overallSpareRate',
  },
  { label: 'Total opens', key: 'totalSparesMissed', id: 'sessionTotalSparesMissed' },
  { label: 'Opens per game', key: 'averageOpensPerGame', id: 'sessionAverageOpensPerGame', prevKey: 'averageOpensPerGame' },
  {
    label: 'Open-percentage',
    key: 'overallMissedRate',
    id: 'sessionOpenPercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you miss a spare if your first throw was not a strike.',
    prevKey: 'overallMissedRate',
  },
];
