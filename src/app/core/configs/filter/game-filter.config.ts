import { FilterConfig } from '../../models/filter.model';

export const GAME_FILTER_CONFIGS: FilterConfig[] = [
  {
    key: 'excludePractice',
    label: 'Exclude Practice Games',
    type: 'boolean',
  },
  {
    key: 'score',
    label: 'Score',
    type: 'range',
    isRange: true,
    rangeKeys: {
      min: 'minScore',
      max: 'maxScore',
    },
  },
  {
    key: 'isClean',
    label: 'Only Clean Games',
    type: 'boolean',
  },
  {
    key: 'isPerfect',
    label: 'Only Perfect Games',
    type: 'boolean',
  },
  {
    key: 'leagues',
    label: 'Leagues',
    type: 'array',
    displayValue: (value: unknown) => {
      const leagues = Array.isArray(value) ? value : [];
      if (leagues.length === 0 || (leagues.length === 1 && leagues[0] === '')) {
        return 'No Leagues';
      }
      return `${leagues.join(', ')}`;
    },
  },
  {
    key: 'balls',
    label: 'Balls',
    type: 'array',
  },
  {
    key: 'patterns',
    label: 'Patterns',
    type: 'array',
    displayValue: (value: unknown) => {
      const patterns = Array.isArray(value) ? value : [];
      if (patterns.length === 0 || (patterns.length === 1 && patterns[0] === '')) {
        return 'No Patterns';
      }
      return `${patterns.join(', ')}`;
    },
  },
  {
    key: 'dateRange',
    label: 'Time Range',
    type: 'date',
    isRange: true,
    rangeKeys: {
      min: 'startDate',
      max: 'endDate',
    },
  },
];
