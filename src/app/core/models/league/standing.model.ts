/**
 * A team's position in the season standings. Modeled now; standings UI is a follow-up phase.
 */
export interface Standing {
  teamId: string;
  position: number;
  wins: number;
  losses: number;
  ties?: number;
  /** League points earned (handicap or scratch, depending on league). */
  points: number;
  /** Total pinfall accumulated. */
  pinfall: number;
}
