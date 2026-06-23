import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { Achievement } from 'src/app/core/models/league';
import { groupGamesIntoSessions, sortGameHistoryByDate } from 'src/app/core/utils/sort-utils/sort.utils';

/**
 * Derives milestones and personal records from a bowler's games. Everything here is
 * computed (never stored), so achievements stay idempotent and always reflect the data.
 *
 * Series totals are taken per league night (sum of a calendar day's games), which matches
 * how league bowlers describe a series ("I shot 645 last night").
 */
@Injectable({ providedIn: 'root' })
export class AchievementService {
  deriveAchievements(games: Game[]): Achievement[] {
    if (!games.length) {
      return [];
    }
    const ordered = sortGameHistoryByDate([...games], true); // ascending
    const achievements: Achievement[] = [];

    const firstAt = (predicate: (g: Game) => boolean) => ordered.find(predicate);

    const first200 = firstAt((g) => g.totalScore >= 200);
    if (first200) {
      achievements.push({ type: 'first200', label: 'First 200 Game', value: first200.totalScore, date: first200.date, gameId: first200.gameId });
    }

    const firstClean = firstAt((g) => !!g.isClean);
    if (firstClean) {
      achievements.push({
        type: 'firstCleanGame',
        label: 'First Clean Game',
        value: firstClean.totalScore,
        date: firstClean.date,
        gameId: firstClean.gameId,
      });
    }

    const firstPerfect = firstAt((g) => !!g.isPerfect);
    if (firstPerfect) {
      achievements.push({ type: 'perfectGame', label: 'Perfect Game (300)', value: 300, date: firstPerfect.date, gameId: firstPerfect.gameId });
      achievements.push({ type: 'honorScore', label: 'Honor Score — 300', value: 300, date: firstPerfect.date, gameId: firstPerfect.gameId });
    }

    // High game (personal record).
    const highGame = ordered.reduce((best, g) => (g.totalScore > best.totalScore ? g : best), ordered[0]);
    achievements.push({ type: 'highGame', label: 'High Game', value: highGame.totalScore, date: highGame.date, gameId: highGame.gameId });

    // Series milestones from per-night totals.
    const sessions = groupGamesIntoSessions(games).map((s) => ({
      date: s.date,
      total: s.games.reduce((sum, g) => sum + g.totalScore, 0),
      count: s.games.length,
    }));
    const seriesNights = sessions.filter((s) => s.count >= 2); // a series is 2+ games

    const first600 = seriesNights.find((s) => s.total >= 600);
    if (first600) {
      achievements.push({ type: 'first600Series', label: 'First 600 Series', value: first600.total, date: first600.date });
    }
    const first700 = seriesNights.find((s) => s.total >= 700);
    if (first700) {
      achievements.push({ type: 'first700Series', label: 'First 700 Series', value: first700.total, date: first700.date });
    }
    if (seriesNights.length) {
      const highSeries = seriesNights.reduce((best, s) => (s.total > best.total ? s : best), seriesNights[0]);
      achievements.push({ type: 'highSeries', label: 'High Series', value: highSeries.total, date: highSeries.date });
    }

    return achievements;
  }
}
