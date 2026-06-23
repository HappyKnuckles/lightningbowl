import { Injectable } from '@angular/core';
import { FeeStructure, FinanceSummary, Payment, Season, Winning } from 'src/app/core/models/league';

@Injectable({ providedIn: 'root' })
export class LeagueFinanceService {
  /** Recurring fees charged every league night (excludes the once-per-season sanction). */
  weeklyRecurringCost(fees: FeeStructure): number {
    return fees.lineage + fees.prizeFund + fees.secretary + fees.sidePots + fees.brackets + fees.mysteryScore + fees.highGamePot;
  }

  /** Full first-week cost including the once-per-season sanction fee. */
  weeklyCostWithSanction(fees: FeeStructure): number {
    return this.weeklyRecurringCost(fees) + fees.sanction;
  }

  /** Roughly four-and-a-third league nights per month. */
  monthlyCost(fees: FeeStructure): number {
    return this.weeklyRecurringCost(fees) * 4.33;
  }

  /** Projected season cost: recurring weekly fees across all scheduled weeks + sanction. */
  projectedSeasonCost(fees: FeeStructure, weeksScheduled: number): number {
    return this.weeklyRecurringCost(fees) * weeksScheduled + fees.sanction;
  }

  totalOwed(payments: Payment[]): number {
    return payments.reduce((sum, p) => sum + (p.amountOwed || 0), 0);
  }

  totalPaid(payments: Payment[]): number {
    return payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }

  /** Outstanding balance (owed minus paid; positive = still owing). */
  balance(payments: Payment[]): number {
    return this.totalOwed(payments) - this.totalPaid(payments);
  }

  totalWinnings(winnings: Winning[]): number {
    return winnings.reduce((sum, w) => sum + (w.amount || 0), 0);
  }

  /** Computes the full financial summary for a season. */
  summarizeSeason(season: Season): FinanceSummary {
    const fees = season.fees;
    const totalOwedFromFees = this.projectedSeasonCost(fees, season.weeksScheduled);
    // Prefer explicit payment records when present; otherwise fall back to the fee schedule.
    const totalOwed = season.payments.length ? this.totalOwed(season.payments) : totalOwedFromFees;
    const totalPaid = this.totalPaid(season.payments);
    const totalWinnings = this.totalWinnings(season.winnings);
    const gamesBowled = season.sessions.reduce((sum, s) => sum + s.gamesBowled, 0);
    const spent = season.payments.length ? totalPaid : totalOwedFromFees;
    return {
      weeklyCost: this.weeklyRecurringCost(fees),
      monthlyCost: this.monthlyCost(fees),
      seasonCost: totalOwedFromFees,
      totalOwed,
      totalPaid,
      balance: totalOwed - totalPaid,
      totalWinnings,
      profitLoss: totalWinnings - spent,
      costPerGame: gamesBowled > 0 ? spent / gamesBowled : 0,
    };
  }

  /** Aggregates the financial summary across every season of a league. */
  summarizeSeasons(seasons: Season[]): FinanceSummary {
    const empty: FinanceSummary = {
      weeklyCost: 0,
      monthlyCost: 0,
      seasonCost: 0,
      totalOwed: 0,
      totalPaid: 0,
      balance: 0,
      totalWinnings: 0,
      profitLoss: 0,
      costPerGame: 0,
    };
    const summaries = seasons.map((s) => this.summarizeSeason(s));
    const totalGames = seasons.reduce((sum, s) => sum + s.sessions.reduce((g, ws) => g + ws.gamesBowled, 0), 0);
    const combined = summaries.reduce((acc, s) => {
      acc.seasonCost += s.seasonCost;
      acc.totalOwed += s.totalOwed;
      acc.totalPaid += s.totalPaid;
      acc.balance += s.balance;
      acc.totalWinnings += s.totalWinnings;
      acc.profitLoss += s.profitLoss;
      return acc;
    }, empty);
    // Most-recent season represents the current weekly/monthly figures.
    const latest = summaries[summaries.length - 1];
    if (latest) {
      combined.weeklyCost = latest.weeklyCost;
      combined.monthlyCost = latest.monthlyCost;
    }
    const spent = combined.totalPaid || combined.seasonCost;
    combined.costPerGame = totalGames > 0 ? spent / totalGames : 0;
    return combined;
  }
}
