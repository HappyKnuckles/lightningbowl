/**
 * Tournament-specific configuration, attached to a League whose eventType is `Tournament`.
 * Modeled now so the data is captured; full bracket / match-play / stepladder UI is a
 * follow-up phase.
 */
export type TournamentFormat = 'qualifyingMatchPlay' | 'qualifyingStepladder' | 'bracketOnly' | 'scratchSingles' | 'handicapSingles' | 'other';

export interface Squad {
  id: string;
  name: string;
  /** Squad start time (epoch ms or HH:mm string kept simple as string). */
  time?: string;
  date?: number;
  maxEntries?: number;
}

export interface Division {
  id: string;
  name: string;
  /** Optional average cap / floor for the division. */
  averageCeiling?: number;
  averageFloor?: number;
}

export interface SideEvent {
  id: string;
  name: string;
  entryFee: number;
}

export interface TournamentConfig {
  format: TournamentFormat;
  /** Number of games per qualifying block. */
  qualifyingBlocks: number;
  gamesPerBlock?: number;
  /** Number of match-play rounds (0 = none). */
  matchPlayRounds: number;
  /** Number of finalists in the stepladder (0 = none). */
  stepladderFinalists: number;
  squads: Squad[];
  divisions: Division[];
  reEntriesAllowed: boolean;
  entryFee: number;
  sideEvents: SideEvent[];
}

export function createDefaultTournamentConfig(): TournamentConfig {
  return {
    format: 'handicapSingles',
    qualifyingBlocks: 1,
    matchPlayRounds: 0,
    stepladderFinalists: 0,
    squads: [],
    divisions: [],
    reEntriesAllowed: false,
    entryFee: 0,
    sideEvents: [],
  };
}
