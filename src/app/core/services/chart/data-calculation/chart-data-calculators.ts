import { Game } from 'src/app/core/models/game.model';
import { Stats } from 'src/app/core/models/stats.model';

export function calculateScoreChartData(gameHistory: Game[], viewMode: 'week' | 'game' | 'session' | 'monthly' | 'yearly' = 'game') {
  switch (viewMode) {
    case 'game':
      return calculatePerGameScoreChartData(gameHistory);
    case 'session':
      return calculateSessionScoreChartData(gameHistory);
    case 'week':
      return calculateWeeklyScoreChartData(gameHistory);
    case 'monthly':
      return calculateMonthlyScoreChartData(gameHistory);
    case 'yearly':
      return calculateYearlyScoreChartData(gameHistory);
    default:
      return calculatePerGameScoreChartData(gameHistory);
  }
}

export function calculatePerGameScoreChartData(gameHistory: Game[]) {
  const gameLabels: string[] = [];
  const overallAverages: number[] = [];
  const differences: number[] = [];
  const gamesPlayedDaily: number[] = [];
  let cumulativeSum = 0;
  let count = 0;

  const sortedGames = gameHistory.sort((a, b) => a.date - b.date);

  sortedGames.forEach((game) => {
    const gameDate = new Date(game.date);
    const formattedDate = `${gameDate.getMonth() + 1}/${gameDate.getDate()}/${gameDate.getFullYear()}`;
    gameLabels.push(`${formattedDate}`);

    cumulativeSum += game.totalScore;
    count++;
    const overallAverage = cumulativeSum / count;
    overallAverages.push(Math.round(overallAverage));

    const difference = game.totalScore - overallAverage;
    differences.push(Math.round(difference));
    gamesPlayedDaily.push(1);
  });

  return { gameLabels, overallAverages, differences, gamesPlayedDaily };
}

export function calculateSessionScoreChartData(gameHistory: Game[]) {
  // Group games by date (session = all games on the same day)
  const sessionData: Record<string, { scores: number[]; count: number; date: number }> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    gameDate.setHours(0, 0, 0, 0);
    const dateKey = gameDate.getTime().toString();

    if (!sessionData[dateKey]) {
      sessionData[dateKey] = { scores: [], count: 0, date: gameDate.getTime() };
    }
    sessionData[dateKey].scores.push(game.totalScore);
    sessionData[dateKey].count++;
  });

  // Sort sessions by date
  const sortedSessions = Object.keys(sessionData).sort((a, b) => parseInt(a) - parseInt(b));
  const gameLabels: string[] = [];
  const overallAverages: number[] = [];
  const differences: number[] = [];
  const gamesPlayedDaily: number[] = [];

  let cumulativeSum = 0;
  let totalCount = 0;

  sortedSessions.forEach((sessionKey) => {
    const session = sessionData[sessionKey];
    const sessionDate = new Date(session.date);
    const formattedDate = `${sessionDate.getMonth() + 1}/${sessionDate.getDate()}/${sessionDate.getFullYear()}`;
    gameLabels.push(formattedDate);

    const sessionScores = session.scores;
    const sessionSum = sessionScores.reduce((sum, score) => sum + score, 0);
    cumulativeSum += sessionSum;
    totalCount += sessionScores.length;

    const overallAverage = cumulativeSum / totalCount;
    overallAverages.push(Math.round(overallAverage));

    const sessionAverage = sessionSum / sessionScores.length;
    const difference = sessionAverage - overallAverage;
    differences.push(Math.round(difference));

    gamesPlayedDaily.push(session.count);
  });

  return { gameLabels, overallAverages, differences, gamesPlayedDaily };
}

export function calculateWeeklyScoreChartData(gameHistory: Game[]) {
  const weeklyData: Record<string, { scores: number[]; count: number }> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const weekStart = getStartOfWeek(gameDate);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { scores: [], count: 0 };
    }
    weeklyData[weekKey].scores.push(game.totalScore);
    weeklyData[weekKey].count++;
  });

  const sortedWeeks = Object.keys(weeklyData).sort();
  const gameLabels: string[] = [];
  const overallAverages: number[] = [];
  const differences: number[] = [];
  const gamesPlayedDaily: number[] = [];

  let cumulativeSum = 0;
  let totalCount = 0;

  sortedWeeks.forEach((weekKey) => {
    const weekDate = new Date(weekKey);
    const formattedWeek = `Week of ${weekDate.getMonth() + 1}/${weekDate.getDate()}`;
    gameLabels.push(formattedWeek);

    const weekScores = weeklyData[weekKey].scores;
    const weekSum = weekScores.reduce((sum, score) => sum + score, 0);
    cumulativeSum += weekSum;
    totalCount += weekScores.length;

    const overallAverage = cumulativeSum / totalCount;
    overallAverages.push(Math.round(overallAverage));

    const weekAverage = weekSum / weekScores.length;
    const difference = weekAverage - overallAverage;
    differences.push(Math.round(difference));

    gamesPlayedDaily.push(weeklyData[weekKey].count);
  });

  return { gameLabels, overallAverages, differences, gamesPlayedDaily };
}

export function calculateMonthlyScoreChartData(gameHistory: Game[]) {
  const monthlyData: Record<string, { scores: number[]; count: number }> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const monthKey = `${gameDate.getFullYear()}-${(gameDate.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { scores: [], count: 0 };
    }
    monthlyData[monthKey].scores.push(game.totalScore);
    monthlyData[monthKey].count++;
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const gameLabels: string[] = [];
  const overallAverages: number[] = [];
  const differences: number[] = [];
  const gamesPlayedDaily: number[] = [];

  let cumulativeSum = 0;
  let totalCount = 0;

  sortedMonths.forEach((monthKey) => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonth = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    gameLabels.push(formattedMonth);

    const monthScores = monthlyData[monthKey].scores;
    const monthSum = monthScores.reduce((sum, score) => sum + score, 0);
    cumulativeSum += monthSum;
    totalCount += monthScores.length;

    const overallAverage = cumulativeSum / totalCount;
    overallAverages.push(Math.round(overallAverage));

    const monthAverage = monthSum / monthScores.length;
    const difference = monthAverage - overallAverage;
    differences.push(Math.round(difference));

    gamesPlayedDaily.push(monthlyData[monthKey].count);
  });

  return { gameLabels, overallAverages, differences, gamesPlayedDaily };
}

export function calculateYearlyScoreChartData(gameHistory: Game[]) {
  const yearlyData: Record<string, { scores: number[]; count: number }> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const yearKey = `${gameDate.getFullYear()}`;

    if (!yearlyData[yearKey]) {
      yearlyData[yearKey] = { scores: [], count: 0 };
    }
    yearlyData[yearKey].scores.push(game.totalScore);
    yearlyData[yearKey].count++;
  });

  const sortedYears = Object.keys(yearlyData).sort();
  const gameLabels: string[] = [];
  const overallAverages: number[] = [];
  const differences: number[] = [];
  const gamesPlayedDaily: number[] = [];

  let cumulativeSum = 0;
  let totalCount = 0;

  sortedYears.forEach((yearKey) => {
    gameLabels.push(yearKey);

    const yearScores = yearlyData[yearKey].scores;
    const yearSum = yearScores.reduce((sum, score) => sum + score, 0);
    cumulativeSum += yearSum;
    totalCount += yearScores.length;

    const overallAverage = cumulativeSum / totalCount;
    overallAverages.push(Math.round(overallAverage));

    const yearAverage = yearSum / yearScores.length;
    const difference = yearAverage - overallAverage;
    differences.push(Math.round(difference));

    gamesPlayedDaily.push(yearlyData[yearKey].count);
  });

  return { gameLabels, overallAverages, differences, gamesPlayedDaily };
}

export function calculateAverageScoreChartData(gameHistory: Game[], viewMode: 'session' | 'weekly' | 'monthly' | 'yearly' = 'monthly') {
  switch (viewMode) {
    case 'session':
      return calculateSessionAverageScoreData(gameHistory);
    case 'weekly':
      return calculateWeeklyAverageScoreData(gameHistory);
    case 'monthly':
      return calculateMonthlyAverageScoreData(gameHistory);
    case 'yearly':
      return calculateYearlyAverageScoreData(gameHistory);
    default:
      return calculateMonthlyAverageScoreData(gameHistory);
  }
}

export function calculateSessionAverageScoreData(gameHistory: Game[]) {
  // Group games by date (session = all games on the same day)
  const sessionData: Record<string, { scores: number[]; date: number }> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    gameDate.setHours(0, 0, 0, 0);
    const dateKey = gameDate.getTime().toString();

    if (!sessionData[dateKey]) {
      sessionData[dateKey] = { scores: [], date: gameDate.getTime() };
    }
    sessionData[dateKey].scores.push(game.totalScore);
  });

  const sortedSessions = Object.keys(sessionData).sort((a, b) => parseInt(a) - parseInt(b));
  const gameLabels: string[] = [];
  const averages: number[] = [];
  const gamesPlayedDaily: number[] = [];

  sortedSessions.forEach((sessionKey) => {
    const session = sessionData[sessionKey];
    const sessionDate = new Date(session.date);
    const formattedDate = `${sessionDate.getMonth() + 1}/${sessionDate.getDate()}/${sessionDate.getFullYear()}`;
    gameLabels.push(formattedDate);

    const sessionAverage = session.scores.reduce((sum, score) => sum + score, 0) / session.scores.length;
    averages.push(Math.round(sessionAverage));

    gamesPlayedDaily.push(session.scores.length);
  });

  return { gameLabels, averages, gamesPlayedDaily };
}

export function calculateWeeklyAverageScoreData(gameHistory: Game[]) {
  const weeklyScores: Record<string, number[]> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const weekStart = getStartOfWeek(gameDate);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyScores[weekKey]) {
      weeklyScores[weekKey] = [];
    }
    weeklyScores[weekKey].push(game.totalScore);
  });

  const sortedWeeks = Object.keys(weeklyScores).sort();
  const gameLabels: string[] = [];
  const averages: number[] = [];
  const gamesPlayedDaily: number[] = [];

  sortedWeeks.forEach((weekKey) => {
    const weekDate = new Date(weekKey);
    const formattedWeek = `Week of ${weekDate.getMonth() + 1}/${weekDate.getDate()}`;
    gameLabels.push(formattedWeek);

    const weekAverage = weeklyScores[weekKey].reduce((sum, score) => sum + score, 0) / weeklyScores[weekKey].length;
    averages.push(Math.round(weekAverage));

    gamesPlayedDaily.push(weeklyScores[weekKey].length);
  });

  return { gameLabels, averages, gamesPlayedDaily };
}

export function calculateMonthlyAverageScoreData(gameHistory: Game[]) {
  const monthlyScores: Record<string, number[]> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const monthKey = `${gameDate.getFullYear()}-${(gameDate.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!monthlyScores[monthKey]) {
      monthlyScores[monthKey] = [];
    }
    monthlyScores[monthKey].push(game.totalScore);
  });

  const sortedMonths = Object.keys(monthlyScores).sort();
  const gameLabels: string[] = [];
  const averages: number[] = [];
  const gamesPlayedDaily: number[] = [];

  sortedMonths.forEach((monthKey) => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedMonth = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    gameLabels.push(formattedMonth);

    const monthAverage = monthlyScores[monthKey].reduce((sum, score) => sum + score, 0) / monthlyScores[monthKey].length;
    averages.push(Math.round(monthAverage));

    gamesPlayedDaily.push(monthlyScores[monthKey].length);
  });

  return { gameLabels, averages, gamesPlayedDaily };
}

export function calculateYearlyAverageScoreData(gameHistory: Game[]) {
  const yearlyScores: Record<string, number[]> = {};

  gameHistory.forEach((game) => {
    const gameDate = new Date(game.date);
    const yearKey = `${gameDate.getFullYear()}`;

    if (!yearlyScores[yearKey]) {
      yearlyScores[yearKey] = [];
    }
    yearlyScores[yearKey].push(game.totalScore);
  });

  const sortedYears = Object.keys(yearlyScores).sort();
  const gameLabels: string[] = [];
  const averages: number[] = [];
  const gamesPlayedDaily: number[] = [];

  sortedYears.forEach((yearKey) => {
    gameLabels.push(yearKey);

    const yearAverage = yearlyScores[yearKey].reduce((sum, score) => sum + score, 0) / yearlyScores[yearKey].length;
    averages.push(Math.round(yearAverage));

    gamesPlayedDaily.push(yearlyScores[yearKey].length);
  });

  return { gameLabels, averages, gamesPlayedDaily };
}

export function calculateThrowChartData(stats: Stats) {
  const throwLabels = ['Strikes', 'Spares', 'Opens'];
  const throwCounts = [stats['strikes'] ?? 0, stats['spares'] ?? 0, stats['opens'] ?? 0];

  return { throwLabels, throwCounts };
}

export function calculatePinChartDataForRadar(stats: Stats): { filteredSpareRates: number[]; filteredMissedCounts: number[] } {
  const filteredSpareRates: number[] = stats.spareRates.slice(1).map((rate) => {
    const numRate = Number(rate);
    return Math.round(numRate * 100) / 100;
  });

  const filteredMissedCounts: number[] = stats.missedCounts.slice(1).map((count, i) => {
    const rate = getRate(count, stats.pinCounts[i + 1]);
    return Math.round(rate * 100) / 100;
  });

  return { filteredSpareRates, filteredMissedCounts };
}

export function calculateThrowChartDataPercentages(stats: Stats): { opens: number; spares: number; strikes: number } {
  const opens = Math.round(Number(stats.openPercentage ?? 0) * 100) / 100;
  const spares = Math.round(Number(stats.sparePercentage ?? 0) * 100) / 100;
  const strikes = Math.round(Number(stats.strikePercentage ?? 0) * 100) / 100;

  return { opens, spares, strikes };
}

// Helper functions
export function getRate(converted: number, missed: number): number {
  const total = converted + missed;
  if (total === 0) {
    return 0;
  }
  const rate = (converted / total) * 100;
  return Math.round(rate * 100) / 100;
}

export function getStartOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(date.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}
