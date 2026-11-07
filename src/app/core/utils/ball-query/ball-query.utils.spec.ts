import { BallFilter, CoreType, CoverstockType, Market } from 'src/app/core/models/filter.model';
import { BallSortField, BallSortOption, SortDirection } from 'src/app/core/models/sort.model';

import { BallQueryInput, buildBallQueryParams } from './ball-query.utils';

const defaults: BallFilter = {
  brands: [],
  coverstocks: [],
  coverstockTypes: [],
  cores: [],
  market: Market.ALL,
  coreType: CoreType.ALL,
  availability: false,
  releaseDate: 'all',
  weight: '15',
  minRg: 0,
  maxRg: 3,
  minDiff: 0,
  maxDiff: 0.1,
  inArsenal: false,
};

const newestFirst: BallSortOption = { field: BallSortField.RELEASE_DATE, direction: SortDirection.DESC, label: 'Newest First' };

const build = (overrides: Partial<BallQueryInput> = {}, filters: Partial<BallFilter> = {}) =>
  buildBallQueryParams({
    filters: { ...defaults, ...filters },
    defaultFilters: defaults,
    search: '',
    sort: newestFirst,
    arsenalIds: [],
    favorites: [],
    page: 0,
    size: 50,
    ...overrides,
  });

describe('buildBallQueryParams', () => {
  it('sends only paging, weight and sort for default filters', () => {
    expect(build()).toEqual({ page: '0', size: '50', weight: '15', sort: 'release_date,desc' });
  });

  it('maps every filter to its API parameter', () => {
    const params = build(
      { page: 2 },
      {
        brands: ['Storm', 'Hammer'],
        cores: ['Velocity'],
        coverstocks: ['TX-16'],
        coverstockTypes: [CoverstockType.SOLID_REACTIVE],
        market: Market.INT,
        coreType: CoreType.ASYMMETRIC,
        availability: true,
        releaseDate: '2024-01-01',
        weight: '14',
      },
    );

    expect(params).toEqual({
      page: '2',
      size: '50',
      weight: '14',
      brand: ['Storm', 'Hammer'],
      core: ['Velocity'],
      coverstock: ['TX-16'],
      coverstockType: ['Solid Reactive'],
      market: 'Overseas',
      coreType: 'Asymmetric',
      available: 'true',
      releaseDate: '2024-01-01',
      sort: 'release_date,desc',
    });
  });

  it('sends spec ranges only when they differ from the defaults', () => {
    const params = build({}, { minRg: 2.45, maxDiff: 0.05 });

    expect(params['minRg']).toBe('2.45');
    expect(params['maxDiff']).toBe('0.05');
    expect(params['maxRg']).toBeUndefined();
    expect(params['minDiff']).toBeUndefined();
  });

  it('turns the arsenal filter into unique ball ids', () => {
    expect(build({ arsenalIds: ['1', '2', '1'] }, { inArsenal: true })['id']).toEqual(['1', '2']);
  });

  it('matches nothing when the arsenal filter is on and the arsenal is empty', () => {
    expect(build({}, { inArsenal: true })['id']).toEqual(['__none__']);
  });

  it('sends favorites so the API lists them first, and nothing without them', () => {
    expect(build({ favorites: ['1-15', '2-14'] })['favorite']).toEqual(['1-15', '2-14']);
    expect(build()['favorite']).toBeUndefined();
  });

  it('sends no sort for Best Match, so search results come back by relevance', () => {
    const bestMatch: BallSortOption = { field: BallSortField.RELEVANCE, direction: SortDirection.DESC, label: 'Best Match' };
    const params = build({ search: '  phaze ', sort: bestMatch });

    expect(params['search']).toBe('phaze');
    expect(params['sort']).toBeUndefined();
  });

  it('sends a chosen sort together with the search, so all matches are sorted', () => {
    const params = build({ search: 'phaze', sort: { field: BallSortField.CORE_RG, direction: SortDirection.DESC, label: 'RG' } });

    expect(params['search']).toBe('phaze');
    expect(params['sort']).toBe('core_rg,desc');
  });
});
