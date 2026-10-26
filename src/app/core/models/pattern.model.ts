/**
 * Pattern types come from the pattern API's OpenAPI description (generated into
 * `src/app/core/api/pattern-api` by `npm run generate:pattern-api`). The aliases keep the names
 * the app has always used.
 */
import type {
  Pattern as ApiPattern,
  PatternCalculation as ApiPatternCalculation,
  PatternChartList as ApiPatternChartList,
  PatternInput as ApiPatternInput,
  PatternInputRow as ApiPatternInputRow,
  PatternPage as ApiPatternPage,
  PatternRow as ApiPatternRow,
  PatternSearchResult as ApiPatternSearchResult,
  PatternSummary as ApiPatternSummary,
} from '../api/pattern-api';

export type Pattern = ApiPattern;
/** One row of a pass with its oil and distances. */
export type PatternRow = ApiPatternRow;
export type ForwardsData = ApiPatternRow;
export type ReverseData = ApiPatternRow;
/** A pattern without rows or charts, as the pattern list loads them. */
export type PatternSummary = ApiPatternSummary;
export type PatternPage = ApiPatternPage;
export type PatternSearchResult = ApiPatternSearchResult;
export type PatternChartList = ApiPatternChartList;
/** A pattern as it is programmed on the lane machine, for adding a custom pattern. */
export type PatternInput = ApiPatternInput;
export type PatternInputRow = ApiPatternInputRow;
/** What the API calculates from a PatternInput, before it is saved. */
export type PatternCalculation = ApiPatternCalculation;
