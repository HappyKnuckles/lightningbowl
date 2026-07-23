import { Pattern } from '../../models/pattern.model';
import { TypeaheadConfig } from '../../models/typeahead-config.model';

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

/**
 * Single-pattern picker, used by the AR view to choose one pattern to project.
 *
 * Unlike the two-up compare config this selects exactly one, and emits the
 * pattern's url (not its title) so the caller can fetch full load data directly.
 */
export function createSinglePatternTypeaheadConfig(searchFn: (term: string) => Promise<{ patterns: Pattern[] }>): TypeaheadConfig<Partial<Pattern>> {
  return {
    title: 'Select a pattern',
    searchPlaceholder: 'Search for a pattern',
    loadingText: 'Loading more patterns...',
    noDataText: 'No patterns found!',
    displayFields: [
      { key: 'category', isSecondary: true },
      { key: 'title', isPrimary: true },
    ],
    searchKeys: [],
    identifierKey: 'url',
    valueKey: 'url',
    maxSelections: 1,
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
