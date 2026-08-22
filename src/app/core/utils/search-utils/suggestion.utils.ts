/**
 * Builds typeahead suggestions for a search term from a list of names.
 * Names starting with the term rank before names merely containing it; duplicates are dropped.
 */
export function buildSearchSuggestions(names: readonly (string | undefined)[], searchTerm: string, limit = 6): string[] {
  const term = searchTerm.trim().toLowerCase();
  if (term.length < 2) {
    return [];
  }

  const seen = new Set<string>();
  const startsWith: string[] = [];
  const contains: string[] = [];

  for (const name of names) {
    if (!name) {
      continue;
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }
    if (lower.startsWith(term)) {
      seen.add(lower);
      startsWith.push(name);
      if (startsWith.length >= limit) {
        break;
      }
    } else if (contains.length < limit && lower.includes(term)) {
      seen.add(lower);
      contains.push(name);
    }
  }

  return [...startsWith, ...contains].slice(0, limit);
}
