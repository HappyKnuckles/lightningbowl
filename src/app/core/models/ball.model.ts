export interface Ball {
  availability: string;
  ball_id: string;
  ball_image: string;
  ball_name: string;
  brand_id: string;
  brand_name: string;
  core_diff: string;
  core_id: string;
  core_image: string;
  core_int_diff: string;
  core_name: string;
  core_rg: string;
  core_type: string;
  core_weight: string;
  coverstock_id: string;
  coverstock_name: string;
  coverstock_type: string;
  factory_finish: string;
  last_update: string;
  position?: number;
  release_date: string;
  thumbnail_image: string;
  us_int: string;
}

export interface Core {
  api_filter_url: string;
  brand: string;
  core_name: string;
  id: string;
}

export interface Coverstock {
  api_filter_url: string;
  brand: string;
  coverstock_name: string;
  id: string;
}

export interface Brand {
  brand_name: string;
  id: string;
  logo: string;
}

export interface BallMetrics {
  flareLabel: string;
  flareScore: number;
  hookLabel: string;
  hookScore: number;
  laneCondition: string;
  laneConditionColor: string;
  lengthLabel: string;
  lengthScore: number;
}

export interface BallTraits {
  diff: number;
  finishGrit: number | null;
  isHybrid: boolean;
  isPearl: boolean;
  isPlastic: boolean;
  isPolished: boolean;
  isSolid: boolean;
  isUrethane: boolean;
  rg: number;
}
