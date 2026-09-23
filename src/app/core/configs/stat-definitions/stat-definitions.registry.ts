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
  // Per-ball stats. These only exist for balls tracked per throw, where every number
  // below is attributed to the throws actually made with that ball.
  ballThrows: { label: 'Throws', key: 'throws', toolTip: 'Every throw made with this ball.' },
  ballFirstBalls: { label: 'First balls', key: 'firstBalls', toolTip: 'Throws at a full rack, the only throws that can strike.' },
  ballSpareBalls: { label: 'Spare balls', key: 'spareBalls', toolTip: 'Throws at a leave.' },
  ballThrowShare: {
    label: 'Share of throws',
    key: 'throwShare',
    isPercentage: true,
    toolTip: 'How much of your total throwing this ball accounts for.',
  },
  ballStrikes: { label: 'Strikes', key: 'strikes' },
  ballStrikePercentage: {
    label: 'Strike %',
    key: 'strikePercentage',
    isPercentage: true,
    toolTip: 'Strikes as a share of this ball’s first balls.',
  },
  ballPocketHits: { label: 'Pocket hits', key: 'pocketHits' },
  ballPocketPercentage: {
    label: 'Pocket %',
    key: 'pocketPercentage',
    isPercentage: true,
    toolTip: 'First balls that hit the pocket. This is how accurately you line this ball up.',
  },
  ballCarryPercentage: {
    label: 'Carry %',
    key: 'carryPercentage',
    isPercentage: true,
    toolTip: 'Strikes as a share of pocket hits. This is the ball’s carry with your accuracy taken out of it.',
  },
  ballFirstBallAverage: { label: 'First ball average', key: 'firstBallAverage', toolTip: 'Average pins knocked down on a full rack.' },
  ballSplits: { label: 'Splits', key: 'splits' },
  ballSplitPercentage: { label: 'Split %', key: 'splitPercentage', isPercentage: true, toolTip: 'First balls that left a split.' },
  ballOpenFrames: { label: 'Open frames', key: 'openFrames' },
  ballOpenFramePercentage: {
    label: 'Open %',
    key: 'openFramePercentage',
    isPercentage: true,
    toolTip: 'Frames this ball started that ended without a mark.',
  },
  ballLongestStrikeStreak: {
    label: 'Longest strike streak',
    key: 'longestStrikeStreak',
    toolTip: 'Consecutive strikes with this ball. Frames led by a different ball do not break the streak.',
  },
  ballCornerPinLeaves: { label: 'Corner pin leaves', key: 'cornerPinLeaves' },
  ballCornerPinPercentage: {
    label: 'Corner pin %',
    key: 'cornerPinPercentage',
    isPercentage: true,
    toolTip: 'A lone corner pin standing, the ringing 10 for a right-hander. A carry problem, not a miss.',
  },
  ballFlatCornerPercentage: {
    label: 'Flat corner %',
    key: 'flatCornerPercentage',
    isPercentage: true,
    toolTip: 'The corner pin left with the pin next to it still up. The ball never reached the corner.',
  },
  ballSolidPercentage: {
    label: 'Solid leave %',
    key: 'solidPercentage',
    isPercentage: true,
    toolTip: 'Clusters left standing after a pocket hit, like the 2-4-5. Usually a sign the ball is reading too early.',
  },
  ballWashoutPercentage: {
    label: 'Washout %',
    key: 'washoutPercentage',
    isPercentage: true,
    toolTip: 'The head pin left standing with a corner pin. A badly missed line.',
  },
  ballLightPercentage: { label: 'Light hit %', key: 'lightPercentage', isPercentage: true, toolTip: 'First balls that came in light on the pocket.' },
  ballHighPercentage: { label: 'High hit %', key: 'highPercentage', isPercentage: true, toolTip: 'First balls that crossed over the head pin.' },
  ballSpareAttempts: { label: 'Spare attempts', key: 'spareAttempts' },
  ballSpareConversionPercentage: { label: 'Spare conversion %', key: 'spareConversionPercentage', isPercentage: true },
  ballSinglePinPercentage: { label: 'Single pin %', key: 'singlePinPercentage', isPercentage: true },
  ballMultiPinPercentage: { label: 'Multi pin %', key: 'multiPinPercentage', isPercentage: true },
  ballSplitConversionPercentage: { label: 'Split conversion %', key: 'splitConversionPercentage', isPercentage: true },
  ballMakeableSplitPercentage: { label: 'Makeable split %', key: 'makeableSplitPercentage', isPercentage: true },
  ballAverageMissMargin: {
    label: 'Average miss margin',
    key: 'averageMissMargin',
    toolTip: 'Pins still standing after a missed spare. Lower means the misses are close.',
  },
  ballAverageFrameValue: {
    label: 'Frame value',
    key: 'averageFrameValue',
    toolTip: 'Average score, bonuses included, of the frames this ball started.',
  },
  ballProjectedAverage: {
    label: 'Projected average',
    key: 'projectedAverage',
    toolTip: 'Frame value × 10, what a full game would average if this ball threw every frame.',
  },
  ballMarkPercentage: { label: 'Mark %', key: 'markPercentage', isPercentage: true, toolTip: 'Frames this ball started that ended in a mark.' },
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
