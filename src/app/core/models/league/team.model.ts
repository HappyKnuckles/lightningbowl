/**
 * Team membership for team/doubles/trios leagues. Modeled now; dedicated editing UI is a
 * follow-up phase.
 */
export type TeammateRole = 'captain' | 'member' | 'substitute';

export interface Teammate {
  id: string;
  name: string;
  role: TeammateRole;
  /** Lineup position (1..n) for the team. */
  position?: number;
  /** Optional book/entering average. */
  average?: number;
}

export interface Team {
  id: string;
  name: string;
  captainId?: string;
  members: Teammate[];
  /** Reserved substitutes not in the regular lineup. */
  substitutes: Teammate[];
  notes?: string;
}

export function createEmptyTeam(id: string, name: string): Team {
  return { id, name, members: [], substitutes: [] };
}
