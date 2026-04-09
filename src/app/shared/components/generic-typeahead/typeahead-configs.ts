import { TypeaheadConfig } from './typeahead-config.interface';
import { Ball, Core, Coverstock } from 'src/app/core/models/ball.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';

export function createBallCoreTypeaheadConfig(): TypeaheadConfig<Core> {
  return {
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
}

export function createBallCoverstockTypeaheadConfig(): TypeaheadConfig<Coverstock> {
  return {
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
}

export function createBallTypeaheadConfig(storageService: StorageService): TypeaheadConfig<Ball> {
  return {
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
    imageUrlGenerator: (ball: Ball) => storageService.url + ball.thumbnail_image,
    customDisplayFormatter: (item: Ball, fieldKey: string) => {
      if (fieldKey === 'brand_name_with_date') {
        return `${item.brand_name} (${item.release_date})`;
      }
      return (item as any)[fieldKey] || '';
    },
  };
}

export function createPatternTypeaheadConfig(searchFn: (term: string) => Promise<{ patterns: Pattern[] }>): TypeaheadConfig<Pattern> {
  return {
    title: 'Select Patterns (max 2)',
    searchPlaceholder: 'Search for a pattern',
    loadingText: 'Loading more patterns...',
    noDataText: 'No patterns found!',
    displayFields: [
      { key: 'category', isSecondary: true },
      { key: 'title', isPrimary: true },
    ],
    searchKeys: [], // Not used for API search
    identifierKey: 'url',
    valueKey: 'title',
    maxSelections: 2,
    searchMode: 'api',
    apiSearchFn: async (searchTerm: string) => {
      const response = await searchFn(searchTerm);
      return { items: response.patterns };
    },
    customDisplayLogic: (pattern: Pattern) => {
      const ratio = pattern.ratio ?? '0';
      const ratioValue = parseFloat(ratio.split(':')[0]);

      let cssClass = '';
      if (ratioValue >= 1 && ratioValue < 4) {
        cssClass = 'red-card';
      } else if (ratioValue >= 4 && ratioValue < 8) {
        cssClass = 'yellow-card';
      } else if (ratioValue >= 8) {
        cssClass = 'green-card';
      }

      return { cssClass };
    },
  };
}

export function createPartialPatternTypeaheadConfig(searchFn: (term: string) => Promise<{ patterns: Pattern[] }>): TypeaheadConfig<Partial<Pattern>> {
  return {
    title: 'Select Patterns (max 2)',
    searchPlaceholder: 'Search for a pattern',
    loadingText: 'Loading more patterns...',
    noDataText: 'No patterns found!',
    displayFields: [
      { key: 'category', isSecondary: true },
      { key: 'title', isPrimary: true },
    ],
    searchKeys: [], // Not used for API search
    identifierKey: 'url',
    valueKey: 'title',
    maxSelections: 2,
    searchMode: 'api',
    apiSearchFn: async (searchTerm: string) => {
      const response = await searchFn(searchTerm);
      return { items: response.patterns };
    },
    customDisplayLogic: (pattern: Partial<Pattern>) => {
      const ratio = pattern.ratio ?? '0';
      const ratioValue = parseFloat(ratio.split(':')[0]);

      let cssClass = '';
      if (ratioValue >= 1 && ratioValue < 4) {
        cssClass = 'red-card';
      } else if (ratioValue >= 4 && ratioValue < 8) {
        cssClass = 'yellow-card';
      } else if (ratioValue >= 8) {
        cssClass = 'green-card';
      }

      return { cssClass };
    },
  };
}
