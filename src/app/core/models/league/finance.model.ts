/**
 * Recurring per-night fee breakdown for a season. All values are per league night
 * unless noted. A missing value is treated as 0 by the finance service.
 */
export interface FeeStructure {
  /** Lane/lineage fee (the cost of the games themselves). */
  lineage: number;
  /** Contribution to the season prize fund. */
  prizeFund: number;
  /** Secretary / league administration fee. */
  secretary: number;
  /** Sanction fee (USBC/DKB membership), usually charged once per season. */
  sanction: number;
  /** Optional side pots bought into each week. */
  sidePots: number;
  /** Optional brackets bought into each week. */
  brackets: number;
  /** Mystery score pot. */
  mysteryScore: number;
  /** High game pot. */
  highGamePot: number;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'partial';

/**
 * A concrete payment record for a given week/session (or an ad-hoc charge).
 */
export interface Payment {
  id: string;
  /** Links to a WeeklySession when the payment is for a specific night. */
  sessionId?: string;
  date: number;
  amountOwed: number;
  amountPaid: number;
  status: PaymentStatus;
  note?: string;
}

export type WinningType = 'sidePot' | 'bracket' | 'seasonPayout' | 'tournamentCash' | 'highGame' | 'mysteryScore' | 'other';

/**
 * Money won back (side pots, brackets, season payouts, tournament cashes, …).
 */
export interface Winning {
  id: string;
  type: WinningType;
  amount: number;
  date: number;
  /** Optional link to the session/night the winning was earned. */
  sessionId?: string;
  note?: string;
}

/** Derived financial summary for a season or whole league. */
export interface FinanceSummary {
  weeklyCost: number;
  monthlyCost: number;
  seasonCost: number;
  totalOwed: number;
  totalPaid: number;
  balance: number;
  totalWinnings: number;
  /** totalWinnings - totalPaid (positive = in profit). */
  profitLoss: number;
  costPerGame: number;
}

export function createEmptyFeeStructure(): FeeStructure {
  return {
    lineage: 0,
    prizeFund: 0,
    secretary: 0,
    sanction: 0,
    sidePots: 0,
    brackets: 0,
    mysteryScore: 0,
    highGamePot: 0,
  };
}
