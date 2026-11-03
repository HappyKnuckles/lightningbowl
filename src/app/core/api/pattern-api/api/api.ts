export * from './categories.api';
import { CategoriesApi } from './categories.api';
export * from './patterns.api';
import { PatternsApi } from './patterns.api';
export * from './search.api';
import { SearchApi } from './search.api';
export * from './statistics.api';
import { StatisticsApi } from './statistics.api';
export const APIS = [CategoriesApi, PatternsApi, SearchApi, StatisticsApi];
