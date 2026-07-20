import { TypeaheadConfig, TypeaheadOption } from '../../models/typeahead-config.model';
import { patternRatioCssClass } from './pattern.config';

/** Pattern filter option, carrying the fields the pattern list is styled by. */
export interface PatternFilterOption extends TypeaheadOption {
  category?: string;
  ratio?: string;
}

export const LEAGUE_FILTER_TYPEAHEAD_CONFIG: TypeaheadConfig<TypeaheadOption> = {
  title: 'Select Leagues',
  searchPlaceholder: 'Search for a league',
  loadingText: 'Loading more leagues...',
  noDataText: 'No leagues found!',
  displayFields: [{ key: 'name', isPrimary: true }],
  searchKeys: [{ name: 'name', weight: 1 }],
  identifierKey: 'value',
  valueKey: 'value',
  searchMode: 'local',
};

export const PATTERN_FILTER_TYPEAHEAD_CONFIG: TypeaheadConfig<PatternFilterOption> = {
  title: 'Select Patterns',
  searchPlaceholder: 'Search for a pattern',
  loadingText: 'Loading more patterns...',
  noDataText: 'No patterns found!',
  displayFields: [
    { key: 'category', isSecondary: true },
    { key: 'name', isPrimary: true },
  ],
  searchKeys: [
    { name: 'name', weight: 1 },
    { name: 'category', weight: 0.7 },
  ],
  identifierKey: 'value',
  valueKey: 'value',
  searchMode: 'local',
  customDisplayLogic: (option: PatternFilterOption) => ({ cssClass: patternRatioCssClass(option.ratio) }),
};
