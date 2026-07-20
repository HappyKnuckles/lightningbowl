import { Pattern } from '../../models/pattern.model';
import { TypeaheadConfig } from '../../models/typeahead-config.model';

/** Colour-codes a pattern by its oil ratio: tight patterns red, medium yellow, open green. */
export function patternRatioCssClass(ratio: string | undefined): string {
  const ratioValue = parseFloat((ratio ?? '0').split(':')[0]);

  if (ratioValue >= 1 && ratioValue < 4) {
    return 'red-card';
  }
  if (ratioValue >= 4 && ratioValue < 8) {
    return 'yellow-card';
  }
  if (ratioValue >= 8) {
    return 'green-card';
  }
  return '';
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
    customDisplayLogic: (pattern: Pattern) => ({ cssClass: patternRatioCssClass(pattern.ratio) }),
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
    customDisplayLogic: (pattern: Partial<Pattern>) => ({ cssClass: patternRatioCssClass(pattern.ratio) }),
  };
}
