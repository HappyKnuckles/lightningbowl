import { Pattern, PatternSummary } from 'src/app/core/models/pattern.model';

/** Patterns are matched by title (games store titles), ignoring case and outer spaces. */
export function patternTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

/** A pattern only known by its title, for a title no known pattern has (yet). */
export function titleOnlyPattern(title: string): Partial<Pattern> {
  return { title, url: title };
}

/** Whether this is a real pattern from the API rather than a `titleOnlyPattern`. */
export function isResolvedPattern(pattern: Partial<Pattern>): boolean {
  return !!pattern.title && !!pattern.url && pattern.url !== pattern.title;
}

/** The pattern without its oil rows, as lists and the known patterns keep it. */
export function toPatternSummary(pattern: Partial<Pattern>): PatternSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { forwards_data, reverse_data, ...summary } = pattern;
  return summary as PatternSummary;
}
