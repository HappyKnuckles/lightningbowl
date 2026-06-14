export interface Alley {
  /** Stable id derived from the OSM element, e.g. "node/123456". */
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  phone?: string;
  website?: string;
  /** Raw OSM opening_hours string, e.g. "Mo-Fr 14:00-23:00; Sa,Su 12:00-24:00". */
  openingHours?: string;
  laneCount?: number;
  /** Distance from the current search origin in meters. */
  distanceMeters?: number;
}

export interface AlleySearchOrigin {
  lat: number;
  lon: number;
  /** What the origin represents — the user's device location or a searched place. */
  source: 'user' | 'search';
  label?: string;
}

export type AlleyOpenState = 'open' | 'closed' | 'unknown';

export interface AlleyFilters {
  openNow: boolean;
  favoritesOnly: boolean;
  radiusKm: number;
}

export const DEFAULT_ALLEY_FILTERS: AlleyFilters = {
  openNow: false,
  favoritesOnly: false,
  radiusKm: 25,
};
