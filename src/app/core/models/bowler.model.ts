/**
 * Represents a bowler (profile) on this device. Games and arsenal balls are owned
 * by bowlers; not to be confused with the OAuth account used by cloud sync.
 */
export interface Bowler {
  bowlerId: string;
  name: string;
  createdAt: number;
}

/** Sentinel used in bowler view selections meaning "no bowler restriction". */
export const ALL_BOWLERS = 'all';
