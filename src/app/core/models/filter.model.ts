/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type GameFilter = {
  balls: string[];
  endDate?: string;
  excludePractice: boolean;
  isClean: boolean;
  isPerfect: boolean;
  leagues: string[];
  maxScore: number;
  minScore: number;
  patterns: string[];
  startDate?: string;
  timeRange: TimeRange;
};

export type BallFilter = {
  availability: boolean;
  brands: string[];
  cores: string[];
  coreType: CoreType;
  coverstocks: string[];
  coverstockTypes: CoverstockType[];
  inArsenal: boolean;
  market: Market;
  maxDiff: number;
  maxRg: number;
  minDiff: number;
  minRg: number;
  releaseDate: string;
  weight: string;
};

export enum TimeRange {
  TODAY = 0,
  WEEK = 1,
  MONTH = 2,
  QUARTER = 3,
  HALF = 4,
  YEAR = 5,
  ALL = 6,
}

export enum Market {
  ALL = 'All',
  INT = 'Overseas',
  US = 'US',
}

export enum CoverstockType {
  HYBRID_REACTIVE = 'Hybrid Reactive',
  MICROCELL_POLYMER = 'Microcell Polymer',
  NOT_URETHANE = 'Not Urethane',
  PARTICLE_PEARL_REACTIVE = 'Particle/Pearl Reactive',
  PARTICLE_REACTIVE = 'Particle Reactive',
  PEARL_REACTIVE = 'Pearl Reactive',
  POLYESTER = 'Polyester',
  RUBBER = 'Rubber',
  SOLID_REACTIVE = 'Solid Reactive',
  URETHANE_HYBRID = 'Urethane Hybrid',
  URETHANE_PARTICLE = 'Urethane Particle',
  URETHANE_PEARL = 'Urethane Pearl',
  URETHANE_SOLID = 'Urethane Solid',
}

export enum CoreType {
  ALL = 'All',
  ASYMMETRIC = 'Asymmetric',
  SYMMETRIC = 'Symmetric',
}

export type AppFilter = GameFilter | BallFilter;

export type FilterValue = string | number | boolean | string[] | null | undefined;
export type FilterRecord = Record<string, FilterValue>;
export type IndexableFilter = AppFilter & FilterRecord;

export interface FilterConfig {
  displayValue?: (value: FilterValue) => string;
  enumValues?: Record<string, string>;
  isRange?: boolean;
  key: string;
  label?: string;
  prefix?: string;
  rangeKeys?: {
    max: string;
    min: string;
  };
  suffix?: string;
  type: 'boolean' | 'string' | 'number' | 'array' | 'date' | 'range' | 'enum';
}
// export enum Availability{
//   ALL = 'all',
//   AVAILABLE = 'available',
//   DISCONTINUED = 'discontinued',
// }
