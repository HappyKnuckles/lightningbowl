import { FeeStructure, Season, createSeason } from 'src/app/core/models/league';
import { LeagueFinanceService } from './league-finance.service';

describe('LeagueFinanceService', () => {
  let service: LeagueFinanceService;

  beforeEach(() => {
    service = new LeagueFinanceService();
  });

  const fees: FeeStructure = {
    lineage: 10,
    prizeFund: 5,
    secretary: 2,
    sanction: 25,
    sidePots: 3,
    brackets: 0,
    mysteryScore: 0,
    highGamePot: 0,
  };

  it('sums recurring weekly fees excluding the once-per-season sanction', () => {
    expect(service.weeklyRecurringCost(fees)).toBe(20);
    expect(service.weeklyCostWithSanction(fees)).toBe(45);
  });

  it('projects season cost as recurring weeks plus sanction', () => {
    expect(service.projectedSeasonCost(fees, 30)).toBe(20 * 30 + 25);
  });

  it('summarizes a season including profit/loss and cost per game', () => {
    const season: Season = createSeason('s1', 1, 'Test', {
      fees,
      weeksScheduled: 10,
      sessions: [
        { id: 'w1', weekNumber: 1, date: 1, gamesScheduled: 3, gamesBowled: 3, attendance: 'present', gameIds: [] },
        { id: 'w2', weekNumber: 2, date: 2, gamesScheduled: 3, gamesBowled: 3, attendance: 'present', gameIds: [] },
      ],
      winnings: [{ id: 'win1', type: 'bracket', amount: 50, date: 1 }],
    });

    const summary = service.summarizeSeason(season);
    expect(summary.weeklyCost).toBe(20);
    expect(summary.seasonCost).toBe(20 * 10 + 25); // 225
    expect(summary.totalWinnings).toBe(50);
    // No payment records -> spent falls back to the projected season cost (225).
    expect(summary.profitLoss).toBe(50 - 225);
    expect(summary.costPerGame).toBeCloseTo(225 / 6, 5);
  });
});
