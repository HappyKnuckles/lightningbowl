import { StatDefinition } from 'src/app/core/models/stat-definitions.model';

// ---------------------------------------------------------------------------
// Central registry: every stat defined once.
// `id` is added per-section via buildSection() to handle prefixing.
// `prevKey` defaults to `key` and is only set explicitly when it differs.
// ---------------------------------------------------------------------------

type StatBase = Omit<StatDefinition, 'id'>;

const STATS = {
  // Core game stats
  totalGames: { label: 'Games', key: 'totalGames' },
  perfectGameCount: {
    label: 'Perfect games',
    key: 'perfectGameCount',
    toolTip: 'A perfect game means every frame is filled with strikes.',
    prevKey: 'perfectGameCount',
  },
  cleanGameCount: {
    label: 'Clean games',
    key: 'cleanGameCount',
    toolTip: 'A clean game means every frame is filled with either a strike or a spare.',
    prevKey: 'cleanGameCount',
  },
  cleanGamePercentage: {
    label: 'Clean game percentage',
    key: 'cleanGamePercentage',
    isPercentage: true,
    toolTip: 'The percentage of how many games were clean games.',
    prevKey: 'cleanGamePercentage',
  },
  averageScore: { label: 'Average', key: 'averageScore', prevKey: 'averageScore' },
  highGame: { label: 'High game', key: 'highGame' },
  lowGame: { label: 'Low game', key: 'lowGame' },
  totalPins: { label: 'Total pins', key: 'totalPins' },
  averageFirstCount: { label: 'First ball average', key: 'averageFirstCount', prevKey: 'averageFirstCount' },

  // Percentages
  markPercentage: {
    label: 'Mark-percentage',
    key: 'markPercentage',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you had any kind of non open.',
    prevKey: 'markPercentage',
  },
  strikePercentage: {
    label: 'Strike-percentage',
    key: 'strikePercentage',
    isPercentage: true,
    toolTip: 'This is the strike probability, calculated as the percentage of strikes you achieve out of a maximum of 12 per game.',
    prevKey: 'strikePercentage',
  },
  sparePercentage: {
    label: 'Spare-percentage',
    key: 'overallSpareRate',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you hit a spare if your first throw was not a strike.',
    prevKey: 'overallSpareRate',
  },
  openPercentage: {
    label: 'Open-percentage',
    key: 'overallMissedRate',
    isPercentage: true,
    toolTip: 'This is the probability of how likely you miss a spare if your first throw was not a strike.',
    prevKey: 'overallMissedRate',
  },

  // Throw counts
  totalStrikes: { label: 'Total strikes', key: 'totalStrikes' },
  averageStrikesPerGame: { label: 'Strikes per game', key: 'averageStrikesPerGame', prevKey: 'averageStrikesPerGame' },
  totalSpares: { label: 'Total spares', key: 'totalSpares' },
  averageSparesPerGame: { label: 'Spares per game', key: 'averageSparesPerGame', prevKey: 'averageSparesPerGame' },
  totalSparesMissed: { label: 'Total opens', key: 'totalSparesMissed' },
  averageOpensPerGame: { label: 'Opens per game', key: 'averageOpensPerGame', prevKey: 'averageOpensPerGame' },
  longestOpenStreak: {
    label: 'Longest open streak',
    key: 'longestOpenStreak',
    toolTip: 'Longest run of frames without a strike or spare (an “open”).',
  },

  // Special games
  dutch200Count: {
    label: 'Dutch 200s',
    key: 'dutch200Count',
    toolTip: 'This is the amount of games you bowled with a score of 200, where you had alternating strikes and spares.',
  },
  varipapa300Count: {
    label: 'Varipapa 300s',
    key: 'varipapa300Count',
    toolTip: 'These are 300 games where you bowled 12 consecutive strikes over two games.',
  },
  allSparesGameCount: {
    label: 'Full spare games',
    key: 'allSparesGameCount',
    toolTip: 'This is the amount of games where you bowled all spares.',
  },

  // Play frequency
  averageGamesPerWeek: { label: 'Games per week', key: 'averageGamesPerWeek' },
  averageGamesPerMonth: { label: 'Games per month', key: 'averageGamesPerMonth' },
  averageGamesPerYear: { label: 'Games per year', key: 'averageGamesPerYear' },
  averageSessionsPerWeek: {
    label: 'Sessions per week',
    key: 'averageSessionsPerWeek',
    toolTip: 'This is how often you usually bowl in a week.',
  },
  averageSessionsPerMonth: {
    label: 'Sessions per month',
    key: 'averageSessionsPerMonth',
    toolTip: 'This is how often you usually bowl in a month.',
  },
  averageGamesPerSession: {
    label: 'Games per session',
    key: 'averageGamesPerSession',
    toolTip: 'This is the amount of games you bowl on average in a session.',
  },

  // Series
  average3SeriesScore: { label: 'Average 3-series score', key: 'average3SeriesScore', prevKey: 'average3SeriesScore' },
  high3Series: { label: 'High 3-series', key: 'high3Series' },
  average4SeriesScore: { label: 'Average 4-series score', key: 'average4SeriesScore', prevKey: 'average4SeriesScore' },
  high4Series: { label: 'High 4-series', key: 'high4Series' },
  average5SeriesScore: { label: 'Average 5-series score', key: 'average5SeriesScore', prevKey: 'average5SeriesScore' },
  high5Series: { label: 'High 5-series', key: 'high5Series' },
  average6SeriesScore: { label: 'Average 6-series score', key: 'average6SeriesScore', prevKey: 'average6SeriesScore' },
  high6Series: { label: 'High 6-series', key: 'high6Series' },

  // Strike streaks
  turkeyCount: { label: 'Turkeys', key: 'turkeyCount', toolTip: 'Number of times you threw exactly 3 strikes in a row.' },
  bagger4Count: { label: '4-baggers', key: 'bagger4Count', toolTip: 'Number of times you threw exactly 4 strikes in a row.' },
  bagger5Count: { label: '5-baggers', key: 'bagger5Count', toolTip: 'Number of times you threw exactly 5 strikes in a row.' },
  bagger6Count: { label: '6-baggers', key: 'bagger6Count', toolTip: 'Number of times you threw exactly 6 strikes in a row.' },
  bagger7Count: { label: '7-baggers', key: 'bagger7Count', toolTip: 'Number of times you threw exactly 7 strikes in a row.' },
  bagger8Count: { label: '8-baggers', key: 'bagger8Count', toolTip: 'Number of times you threw exactly 8 strikes in a row.' },
  bagger9Count: { label: '9-baggers', key: 'bagger9Count', toolTip: 'Number of times you threw exactly 9 strikes in a row.' },
  bagger10Count: { label: '10-baggers', key: 'bagger10Count', toolTip: 'Number of times you threw exactly 10 strikes in a row.' },
  bagger11Count: { label: '11-baggers', key: 'bagger11Count', toolTip: 'Number of times you threw exactly 11 strikes in a row.' },
  longestStrikeStreak: {
    label: 'Longest strike streak',
    key: 'longestStrikeStreak',
    toolTip: 'This is the amount of consecutive strikes you bowled in a row. It is considered over multiple games on the same day.',
  },
  strikeToStrikePercentage: {
    label: 'Strike to strike percentage',
    key: 'strikeToStrikePercentage',
    isPercentage: true,
    prevKey: 'strikeToStrikePercentage',
    toolTip: 'This is the probability of how likely you throw a strike after a strike.',
  },
  strikeoutCount: {
    label: 'Strikeouts',
    key: 'strikeoutCount',
    toolTip: 'This is the amount of times you threw 3-strikes in tenth frame.',
  },

  // Spare types
  singlePinSpares: {
    label: 'Single pin spares',
    key: 'singlePinSpares',
    secondaryKey: 'singlePinSpareOpportunities',
    toolTip: 'Number of spares made when only one pin was left standing after the first ball.',
  },
  multiPinSpares: {
    label: 'Multi pin spares',
    key: 'multiPinSpares',
    secondaryKey: 'multiPinSpareOpportunities',
    toolTip: 'Number of spares made when multiple pins were left standing after the first ball.',
  },
  singlePinSparePercentage: {
    label: 'Single pin spare %',
    key: 'singlePinSparePercentage',
    isPercentage: true,
    prevKey: 'singlePinSparePercentage',
  },
  multiPinSparePercentage: {
    label: 'Multi pin spare %',
    key: 'multiPinSparePercentage',
    isPercentage: true,
    prevKey: 'multiPinSparePercentage',
  },

  // Pin / pocket / splits
  pocketHits: {
    label: 'Pocket hits',
    key: 'pocketHits',
    secondaryKey: 'totalFirstBalls',
    toolTip: 'Number of times you hit the pocket on the first ball (knocked down at least pins 1 and 2, or 1 and 3).',
  },
  pocketHitPercentage: {
    label: 'Pocket hit %',
    key: 'pocketHitPercentage',
    isPercentage: true,
    prevKey: 'pocketHitPercentage',
    toolTip: 'Percentage of first balls where you hit the pocket.',
  },
  nonSplitSpares: {
    label: 'Non-split spares',
    key: 'nonSplitSpares',
    secondaryKey: 'nonSplitSpareOpportunities',
  },
  nonSplitSparePercentage: {
    label: 'Non-split spare %',
    key: 'nonSplitSparePercentage',
    isPercentage: true,
    prevKey: 'nonSplitSparePercentage',
  },
  splits: {
    label: 'Split conversions',
    key: 'splits',
    secondaryKey: 'splitOpportunities',
  },
  splitConversionPercentage: {
    label: 'Split conversion %',
    key: 'splitConversionPercentage',
    isPercentage: true,
    prevKey: 'splitConversionPercentage',
  },
  makeableSplits: {
    label: 'Makeable split conversions',
    key: 'makeableSplits',
    secondaryKey: 'makeableSplitOpportunities',
    toolTip: 'Number of makeable splits converted (excludes impossible splits like 7-10, 4-6, etc.).',
  },
  makeableSplitPercentage: {
    label: 'Makeable split %',
    key: 'makeableSplitPercentage',
    isPercentage: true,
    prevKey: 'makeableSplitPercentage',
    toolTip: 'Percentage of makeable splits that were successfully converted.',
  },
} as const satisfies Record<string, StatBase>;

export type StatId = keyof typeof STATS;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Build a section of stat definitions from a list of stat IDs.
 *
 * @param ids       Ordered list of stat IDs from the registry.
 * @param idPrefix  Optional prefix for the generated `id` field.
 *                  - '' (default) -> id equals the stat key (e.g. 'totalGames')
 *                  - 'league-'    -> id is 'league-totalGames'
 *                  - 'session'    -> id is 'sessionTotalGames' (camelCased)
 */
export function buildSection(ids: StatId[], idPrefix = ''): StatDefinition[] {
  return ids.map((statId) => {
    const base = STATS[statId];
    let id: string;
    if (!idPrefix) {
      id = statId;
    } else if (idPrefix.endsWith('-')) {
      id = `${idPrefix}${statId}`;
    } else {
      id = `${idPrefix}${capitalize(statId)}`;
    }
    return { ...base, id };
  });
}
