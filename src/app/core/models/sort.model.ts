export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum BallSortField {
  BALL_NAME = 'ball_name',
  BRAND_NAME = 'brand_name',
  CORE_DIFF = 'core_diff',
  CORE_INT_DIFF = 'core_int_diff',
  CORE_RG = 'core_rg',
  CORE_TYPE = 'core_type',
  COVERSTOCK_TYPE = 'coverstock_type',
  FACTORY_FINISH = 'factory_finish',
  RELEASE_DATE = 'release_date',
}

export enum PatternSortField {
  CATEGORY = 'category',
  DISTANCE = 'distance',
  FORWARD = 'forward',
  PUMP = 'pump',
  RATIO = 'ratio',
  REVERSE = 'reverse',
  TITLE = 'title',
  VOLUME = 'volume',
}

export enum GameSortField {
  DATE = 'date',
  IS_CLEAN = 'isClean',
  IS_PERFECT = 'isPerfect',
  IS_PRACTICE = 'isPractice',
  LEAGUE = 'league',
  TOTAL_SCORE = 'totalScore',
}

export type SortField = BallSortField | PatternSortField | GameSortField;

export interface SortOption<T extends SortField = SortField> {
  direction: SortDirection;
  field: T;
  label: string;
}

export type BallSortOption = SortOption<BallSortField>;
export type PatternSortOption = SortOption<PatternSortField>;
export type GameSortOption = SortOption<GameSortField>;
