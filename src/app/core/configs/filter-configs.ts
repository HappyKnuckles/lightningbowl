import { FilterConfig } from '../../shared/components/generic-filter-active/generic-filter-active.component';
import { Market, CoreType } from 'src/app/core/models/filter.model';

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
  },
];

export const BALL_FILTER_CONFIGS: FilterConfig[] = [
  {
    key: 'weight',
    label: 'Weight',
    type: 'string',
    suffix: 'lbs',
  },
  {
    key: 'coreType',
    label: 'Core Type',
    type: 'enum',
    enumValues: {
      [CoreType.ALL]: 'All',
      [CoreType.ASYMMETRIC]: 'Asymmetric',
      [CoreType.SYMMETRIC]: 'Symmetric',
    },
  },
  {
    key: 'availability',
    label: 'Availability',
    type: 'boolean',
    displayValue: (value: unknown) => (value ? 'Available' : 'Discontinued'),
  },
  {
    key: 'market',
    label: 'Market',
    type: 'enum',
    enumValues: {
      [Market.ALL]: 'All',
      [Market.US]: 'US',
      [Market.INT]: 'Overseas',
    },
  },
  {
    key: 'inArsenal',
    label: 'Only Arsenal Balls',
    type: 'boolean',
  },
  {
    key: 'brands',
    label: 'Brands',
    type: 'array',
  },
  {
    key: 'coverstocks',
    label: 'Coverstocks',
    type: 'array',
  },
  {
    key: 'coverstockTypes',
    label: 'Coverstock Types',
    type: 'array',
    displayValue: (value: unknown) => {
      const types = Array.isArray(value) ? value : [];
      return types.join(', ');
    },
  },
  {
    key: 'cores',
    label: 'Cores',
    type: 'array',
  },
  {
    key: 'rg',
    label: 'RG',
    type: 'range',
    isRange: true,
    rangeKeys: {
      min: 'minRg',
      max: 'maxRg',
    },
  },
  {
    key: 'diff',
    label: 'Diff',
    type: 'range',
    isRange: true,
    rangeKeys: {
      min: 'minDiff',
      max: 'maxDiff',
    },
  },
];
