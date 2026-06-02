import { CoreType, FilterConfig, Market } from '../../models/filter.model';

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
    displayValue: (value) => (value ? 'Available' : 'Discontinued'),
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
    displayValue: (value) => {
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
