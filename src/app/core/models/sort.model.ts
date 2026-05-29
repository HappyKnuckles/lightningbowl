export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum BallSortField {
  BALL_NAME = 'ball_name',
  BRAND_NAME = 'brand_name',
  RELEASE_DATE = 'release_date',
  CORE_RG = 'core_rg',
  CORE_DIFF = 'core_diff',
  CORE_INT_DIFF = 'core_int_diff',
  CORE_TYPE = 'core_type',
  COVERSTOCK_TYPE = 'coverstock_type',
  FACTORY_FINISH = 'factory_finish',
}

export enum PatternSortField {
  TITLE = 'title',
  CATEGORY = 'category',
  DISTANCE = 'distance',
  RATIO = 'ratio',
  VOLUME = 'volume',
  FORWARD = 'forward',
  REVERSE = 'reverse',
  PUMP = 'pump',
}

export enum GameSortField {
  TOTAL_SCORE = 'totalScore',
  DATE = 'date',
  LEAGUE = 'league',
  IS_PRACTICE = 'isPractice',
  IS_CLEAN = 'isClean',
  IS_PERFECT = 'isPerfect',
}

export interface SortOption<T> {
  field: T;
  direction: SortDirection;
  label: string;
}

export type BallSortOption = SortOption<BallSortField>;
export type PatternSortOption = SortOption<PatternSortField>;
export type GameSortOption = SortOption<GameSortField>;
