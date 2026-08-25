import { Ball, Brand, Core, Coverstock } from 'src/app/core/models/ball.model';

import { BOWWWL_URL } from '../../constants/app.constants';
import { TypeaheadConfig } from '../../models/typeahead-config.model';

export const BALL_BRAND_TYPEAHEAD_CONFIG: TypeaheadConfig<Brand> = {
  title: 'Select Brands',
  searchPlaceholder: 'Search for brands',
  loadingText: 'Loading more brands...',
  noDataText: 'No brands found!',
  displayFields: [{ key: 'brand_name', isPrimary: true }],
  searchKeys: [{ name: 'brand_name', weight: 1 }],
  identifierKey: 'id',
  valueKey: 'brand_name',
  searchMode: 'local',
  showImages: true,
  imageShape: 'rect',
  imageUrlGenerator: (brand: Brand) => brand.logo,
};

export const BALL_CORE_TYPEAHEAD_CONFIG: TypeaheadConfig<Core> = {
  title: 'Select Cores',
  searchPlaceholder: 'Search for cores',
  loadingText: 'Loading more cores...',
  noDataText: 'No cores found!',
  displayFields: [
    { key: 'brand', isSecondary: true },
    { key: 'core_name', isPrimary: true },
  ],
  searchKeys: [
    { name: 'core_name', weight: 1 },
    { name: 'brand', weight: 0.7 },
  ],
  identifierKey: 'id',
  valueKey: 'core_name',
  searchMode: 'local',
};

export const BALL_COVERSTOCK_TYPEAHEAD_CONFIG: TypeaheadConfig<Coverstock> = {
  title: 'Select Coverstocks',
  searchPlaceholder: 'Search for coverstocks',
  loadingText: 'Loading more coverstocks...',
  noDataText: 'No coverstocks found!',
  displayFields: [
    { key: 'brand', isSecondary: true },
    { key: 'coverstock_name', isPrimary: true },
  ],
  searchKeys: [
    { name: 'coverstock_name', weight: 1 },
    { name: 'brand', weight: 0.7 },
  ],
  identifierKey: 'id',
  valueKey: 'coverstock_name',
  searchMode: 'local',
};

export const BALL_TYPEAHEAD_CONFIG: TypeaheadConfig<Ball> = {
  title: 'New Ball',
  searchPlaceholder: 'Search for balls',
  loadingText: 'Loading more balls...',
  noDataText: 'No balls found!',
  displayFields: [
    { key: 'brand_name_with_date', isSecondary: true }, // Special combined field
    { key: 'ball_name', isPrimary: true },
  ],
  searchKeys: [
    { name: 'ball_name', weight: 1 },
    { name: 'brand_name', weight: 0.9 },
    { name: 'core_name', weight: 0.7 },
    { name: 'coverstock_name', weight: 0.7 },
    { name: 'factory_finish', weight: 0.5 },
  ],
  identifierKey: 'ball_id',
  valueKey: 'ball_id',
  searchMode: 'local',
  showImages: true,
  imageUrlGenerator: (ball: Ball) => BOWWWL_URL + ball.thumbnail_image,
  customDisplayFormatter: (item: Ball, fieldKey: string) => {
    if (fieldKey === 'brand_name_with_date') {
      return `${item.brand_name} (${item.release_date})`;
    }
    const value = item[fieldKey as keyof Ball];
    return value != null ? String(value) : '';
  },
};
