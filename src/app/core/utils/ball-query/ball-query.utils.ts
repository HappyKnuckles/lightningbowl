import { BallQueryParams } from 'src/app/core/models/ball.model';
import { BallFilter, CoreType, Market } from 'src/app/core/models/filter.model';
import { BallSortField, BallSortOption } from 'src/app/core/models/sort.model';

export interface BallQueryInput {
  /** Ball ids in the user's arsenal, used for the "only arsenal balls" filter. */
  arsenalIds: string[];
  defaultFilters: BallFilter;
  /** `ballId-coreWeight` keys of favorites to list first; empty for the regular order. */
  favorites: string[];
  filters: BallFilter;
  page: number;
  search: string;
  size: number;
  sort: BallSortOption;
}

/**
 * Translates the ball page state into query parameters for `GET balls`.
 *
 * - The weight filter always applies, so the list matches the offline catalog.
 * - Spec ranges are only sent when changed from their defaults, so balls with
 *   missing specs aren't hidden by an untouched slider.
 * - Favorites are sent as `favorite`, so the API lists them first.
 * - "Best Match" sends no sort, so the API orders search results by
 *   relevance; any other sort is sent and orders all matches.
 */
export function buildBallQueryParams(input: BallQueryInput): BallQueryParams {
  const { filters, defaultFilters } = input;
  const params: BallQueryParams = {
    page: String(input.page),
    size: String(input.size),
  };

  const set = (key: string, value: string | string[] | undefined) => {
    if (value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    params[key] = value;
  };

  set('weight', filters.weight || undefined);
  set('brand', filters.brands);
  set('core', filters.cores);
  set('coverstock', filters.coverstocks);
  set('coverstockType', filters.coverstockTypes);
  set('market', filters.market !== Market.ALL ? filters.market : undefined);
  set('coreType', filters.coreType !== CoreType.ALL ? filters.coreType : undefined);
  set('available', filters.availability ? 'true' : undefined);
  set('releaseDate', filters.releaseDate && filters.releaseDate !== 'all' ? filters.releaseDate : undefined);

  if (filters.minRg !== defaultFilters.minRg) set('minRg', String(filters.minRg));
  if (filters.maxRg !== defaultFilters.maxRg) set('maxRg', String(filters.maxRg));
  if (filters.minDiff !== defaultFilters.minDiff) set('minDiff', String(filters.minDiff));
  if (filters.maxDiff !== defaultFilters.maxDiff) set('maxDiff', String(filters.maxDiff));

  if (filters.inArsenal) {
    // An empty arsenal must match nothing, not everything.
    set('id', input.arsenalIds.length > 0 ? [...new Set(input.arsenalIds)] : ['__none__']);
  }

  // Favorites first is ranked by the API, so it holds across pages.
  set('favorite', input.favorites);

  const search = input.search.trim();
  if (search) set('search', search);
  if (input.sort.field !== BallSortField.RELEVANCE) set('sort', `${input.sort.field},${input.sort.direction}`);

  return params;
}
