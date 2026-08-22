import { makeGame, makeStats } from 'src/testing/fixtures';
import {
  calculateAverageScoreChartData,
  calculateMonthlyAverageScoreData,
  calculateMonthlyScoreChartData,
  calculatePerGameScoreChartData,
  calculatePinChartDataForRadar,
  calculateScoreChartData,
  calculateSessionAverageScoreData,
  calculateSessionScoreChartData,
  calculateThrowChartData,
  calculateThrowChartDataPercentages,
  calculateWeeklyAverageScoreData,
  calculateWeeklyScoreChartData,
  calculateYearlyAverageScoreData,
  calculateYearlyScoreChartData,
  getRate,
  getStartOfWeek,
} from './chart-data-calculators';

/**
 * Local-time date, since every calculator formats labels with getMonth/getDate/getFullYear.
 * Building with Date.UTC would make the expected labels timezone-dependent.
 */
const at = (year: number, month: number, day: number) => new Date(year, month - 1, day).getTime();

const gameOn = (date: number, totalScore: number) => makeGame({ date, totalScore, gameId: `${date}-${totalScore}` });

describe('chart-data-calculators', () => {
  describe('getRate', () => {
    it('returns 0 when nothing was attempted', () => {
      expect(getRate(0, 0)).toBe(0);
    });

    it('returns the converted share of all attempts', () => {
      expect(getRate(5, 5)).toBe(50);
      expect(getRate(10, 0)).toBe(100);
      expect(getRate(0, 4)).toBe(0);
    });

    it('rounds to two decimals', () => {
      expect(getRate(1, 2)).toBe(33.33);
      expect(getRate(2, 1)).toBe(66.67);
    });
  });

  describe('getStartOfWeek', () => {
    it('treats Monday as the first day of the week', () => {
      // 12 Jan 2026 is a Monday; the 14th is the Wednesday of that week.
      expect(getStartOfWeek(new Date(2026, 0, 14)).getDate()).toBe(12);
      expect(getStartOfWeek(new Date(2026, 0, 12)).getDate()).toBe(12);
    });

    it('rolls Sunday back to the Monday that opened the week', () => {
      // 18 Jan 2026 is a Sunday — it belongs to the week starting the 12th, not the 19th.
      expect(getStartOfWeek(new Date(2026, 0, 18)).getDate()).toBe(12);
    });

    it('zeroes the time component', () => {
      const start = getStartOfWeek(new Date(2026, 0, 14, 13, 45, 30, 500));

      expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0]);
    });

    it('leaves the date it was given untouched', () => {
      const input = new Date(2026, 0, 14);

      getStartOfWeek(input);

      expect(input.getDate()).toBe(14);
    });
  });

  describe('calculateThrowChartData', () => {
    it('pairs the three throw outcomes with their counts', () => {
      const stats = makeStats({ strikes: 12, spares: 5, opens: 3 });

      expect(calculateThrowChartData(stats)).toEqual({
        throwLabels: ['Strikes', 'Spares', 'Opens'],
        throwCounts: [12, 5, 3],
      });
    });

    it('falls back to zero counts when the stats carry no throw totals', () => {
      expect(calculateThrowChartData(makeStats()).throwCounts).toEqual([0, 0, 0]);
    });
  });

  describe('calculateThrowChartDataPercentages', () => {
    it('rounds each percentage to two decimals', () => {
      const stats = makeStats({ openPercentage: 12.3456, sparePercentage: 33.333, strikePercentage: 54.321 });

      expect(calculateThrowChartDataPercentages(stats)).toEqual({ opens: 12.35, spares: 33.33, strikes: 54.32 });
    });

    it('defaults to zero for absent percentages', () => {
      expect(calculateThrowChartDataPercentages(makeStats())).toEqual({ opens: 0, spares: 0, strikes: 0 });
    });
  });

  describe('calculatePinChartDataForRadar', () => {
    it('drops the unused leading entry and reports rates per pin', () => {
      const stats = makeStats({
        // Index 0 is padding; pins 1-10 follow.
        spareRates: [0, 100, 50, 0, 0, 0, 0, 0, 0, 0, 25.456],
        missedCounts: [0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 3],
        pinCounts: [0, 10, 5, 0, 0, 0, 0, 0, 0, 0, 1],
      });

      const { filteredSpareRates, filteredMissedCounts } = calculatePinChartDataForRadar(stats);

      expect(filteredSpareRates).toHaveLength(10);
      expect(filteredSpareRates[0]).toBe(100);
      expect(filteredSpareRates[9]).toBe(25.46);
      // Pin 2: 5 missed against 5 counted → 50%.
      expect(filteredMissedCounts[1]).toBe(50);
    });
  });

  describe('calculatePerGameScoreChartData', () => {
    it('tracks the running average and each game against it', () => {
      const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2026, 1, 6), 200), gameOn(at(2026, 1, 7), 150)];

      const { gameLabels, overallAverages, differences, gamesPlayedDaily } = calculatePerGameScoreChartData(games);

      expect(gameLabels).toEqual(['1/5/2026', '1/6/2026', '1/7/2026']);
      expect(overallAverages).toEqual([100, 150, 150]);
      expect(differences).toEqual([0, 50, 0]);
      expect(gamesPlayedDaily).toEqual([1, 1, 1]);
    });

    it('orders games oldest first regardless of input order', () => {
      const games = [gameOn(at(2026, 1, 7), 150), gameOn(at(2026, 1, 5), 100)];

      expect(calculatePerGameScoreChartData(games).gameLabels).toEqual(['1/5/2026', '1/7/2026']);
    });

    it('does not reorder the array it was handed', () => {
      const newer = gameOn(at(2026, 1, 7), 150);
      const older = gameOn(at(2026, 1, 5), 100);
      const games = [newer, older];

      calculatePerGameScoreChartData(games);

      expect(games).toEqual([newer, older]);
    });

    it('returns empty series for an empty history', () => {
      expect(calculatePerGameScoreChartData([])).toEqual({ gameLabels: [], overallAverages: [], differences: [], gamesPlayedDaily: [] });
    });
  });

  describe('calculateSessionScoreChartData', () => {
    it('collapses games bowled on the same day into one session', () => {
      const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2026, 1, 5), 200), gameOn(at(2026, 1, 6), 240)];

      const { gameLabels, overallAverages, differences, gamesPlayedDaily } = calculateSessionScoreChartData(games);

      expect(gameLabels).toEqual(['1/5/2026', '1/6/2026']);
      // Session one averages 150; adding a 240 pulls the overall average to 180.
      expect(overallAverages).toEqual([150, 180]);
      expect(differences).toEqual([0, 60]);
      expect(gamesPlayedDaily).toEqual([2, 1]);
    });

    it('ignores the time of day when grouping a session', () => {
      const morning = new Date(2026, 0, 5, 9, 0).getTime();
      const evening = new Date(2026, 0, 5, 21, 30).getTime();

      const { gamesPlayedDaily } = calculateSessionScoreChartData([gameOn(morning, 100), gameOn(evening, 200)]);

      expect(gamesPlayedDaily).toEqual([2]);
    });
  });

  describe('calculateWeeklyScoreChartData', () => {
    it('groups games into Monday-anchored weeks', () => {
      // 14th and 18th share a week; the 19th opens the next one.
      const games = [gameOn(at(2026, 1, 14), 100), gameOn(at(2026, 1, 18), 200), gameOn(at(2026, 1, 19), 180)];

      const { gameLabels, gamesPlayedDaily } = calculateWeeklyScoreChartData(games);

      expect(gameLabels).toEqual(['Week of 1/12', 'Week of 1/19']);
      expect(gamesPlayedDaily).toEqual([2, 1]);
    });

    it('labels a week by the Monday it starts on, not the Sunday before', () => {
      // Guards the UTC round-trip that used to shift the label back a day east of Greenwich.
      expect(calculateWeeklyScoreChartData([gameOn(at(2026, 1, 14), 100)]).gameLabels).toEqual(['Week of 1/12']);
      expect(calculateWeeklyAverageScoreData([gameOn(at(2026, 1, 14), 100)]).gameLabels).toEqual(['Week of 1/12']);
    });
  });

  describe('calculateMonthlyScoreChartData', () => {
    it('labels months by short name and tracks the running average', () => {
      const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2026, 1, 20), 200), gameOn(at(2026, 2, 3), 240)];

      const { gameLabels, overallAverages, differences, gamesPlayedDaily } = calculateMonthlyScoreChartData(games);

      expect(gameLabels).toEqual(['Jan 2026', 'Feb 2026']);
      expect(overallAverages).toEqual([150, 180]);
      expect(differences).toEqual([0, 60]);
      expect(gamesPlayedDaily).toEqual([2, 1]);
    });

    it('keeps months in chronological order across a year boundary', () => {
      const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2025, 12, 5), 200)];

      expect(calculateMonthlyScoreChartData(games).gameLabels).toEqual(['Dec 2025', 'Jan 2026']);
    });
  });

  describe('calculateYearlyScoreChartData', () => {
    it('groups by year and labels with the year alone', () => {
      const games = [gameOn(at(2026, 1, 5), 200), gameOn(at(2026, 6, 5), 300), gameOn(at(2025, 5, 5), 100)];

      const { gameLabels, overallAverages, gamesPlayedDaily } = calculateYearlyScoreChartData(games);

      expect(gameLabels).toEqual(['2025', '2026']);
      // 2025 averages 100; folding in 200 and 300 lifts the overall to 200.
      expect(overallAverages).toEqual([100, 200]);
      expect(gamesPlayedDaily).toEqual([1, 2]);
    });
  });

  describe('calculateScoreChartData', () => {
    const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2026, 1, 5), 200), gameOn(at(2026, 2, 3), 240)];

    it('defaults to the per-game view', () => {
      expect(calculateScoreChartData(games)).toEqual(calculatePerGameScoreChartData(games));
    });

    it('dispatches each view mode to its calculator', () => {
      expect(calculateScoreChartData(games, 'game')).toEqual(calculatePerGameScoreChartData(games));
      expect(calculateScoreChartData(games, 'session')).toEqual(calculateSessionScoreChartData(games));
      expect(calculateScoreChartData(games, 'week')).toEqual(calculateWeeklyScoreChartData(games));
      expect(calculateScoreChartData(games, 'monthly')).toEqual(calculateMonthlyScoreChartData(games));
      expect(calculateScoreChartData(games, 'yearly')).toEqual(calculateYearlyScoreChartData(games));
    });
  });

  describe('average score series', () => {
    const games = [gameOn(at(2026, 1, 5), 100), gameOn(at(2026, 1, 5), 200), gameOn(at(2026, 2, 3), 240)];

    it('averages each session without a running total', () => {
      expect(calculateSessionAverageScoreData(games)).toEqual({
        gameLabels: ['1/5/2026', '2/3/2026'],
        averages: [150, 240],
        gamesPlayedDaily: [2, 1],
      });
    });

    it('averages each month', () => {
      expect(calculateMonthlyAverageScoreData(games)).toEqual({
        gameLabels: ['Jan 2026', 'Feb 2026'],
        averages: [150, 240],
        gamesPlayedDaily: [2, 1],
      });
    });

    it('averages each year', () => {
      expect(calculateYearlyAverageScoreData(games)).toEqual({
        gameLabels: ['2026'],
        averages: [180],
        gamesPlayedDaily: [3],
      });
    });

    it('averages each week', () => {
      const { averages, gamesPlayedDaily } = calculateWeeklyAverageScoreData([gameOn(at(2026, 1, 14), 100), gameOn(at(2026, 1, 18), 200)]);

      expect(averages).toEqual([150]);
      expect(gamesPlayedDaily).toEqual([2]);
    });

    it('defaults to the monthly view and dispatches the rest', () => {
      expect(calculateAverageScoreChartData(games)).toEqual(calculateMonthlyAverageScoreData(games));
      expect(calculateAverageScoreChartData(games, 'session')).toEqual(calculateSessionAverageScoreData(games));
      expect(calculateAverageScoreChartData(games, 'weekly')).toEqual(calculateWeeklyAverageScoreData(games));
      expect(calculateAverageScoreChartData(games, 'yearly')).toEqual(calculateYearlyAverageScoreData(games));
    });
  });
});
