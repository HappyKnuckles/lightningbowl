/**
 * Generates a reasonably-unique id using the same ad-hoc style already used for games
 * (see game-data-transform.service.ts). Optionally prefixed, e.g. `generateId('lg')`.
 */
export function generateId(prefix = ''): string {
  const core = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return prefix ? `${prefix}_${core}` : core;
}
