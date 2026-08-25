export interface Alley {
  address?: string;
  /** Distance from the current search origin in meters. */
  distanceMeters?: number;
  /** Stable id derived from the OSM element, e.g. "node/123456". */
  id: string;
  laneCount?: number;
  lat: number;
  lon: number;
  name: string;
  /** Raw OSM opening_hours string, e.g. "Mo-Fr 14:00-23:00; Sa,Su 12:00-24:00". */
  openingHours?: string;
  phone?: string;
  website?: string;
}

export interface AlleySearchOrigin {
  label?: string;
  lat: number;
  lon: number;
  /** What the origin represents — the user's device location or a searched place. */
  source: 'user' | 'search';
}

export type AlleyOpenState = 'open' | 'closed' | 'unknown';

export interface AlleyFilters {
  favoritesOnly: boolean;
  openNow: boolean;
  radiusKm: number;
}

export const DEFAULT_ALLEY_FILTERS: AlleyFilters = {
  openNow: false,
  favoritesOnly: false,
  radiusKm: 25,
};
