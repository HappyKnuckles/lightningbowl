import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { DAYS_OF_WEEK, League, Season, WeeklySession, createEmptyFeeStructure, createSeason } from 'src/app/core/models/league';
import { generateId } from 'src/app/core/utils/id-utils/id.utils';
import { groupGamesIntoSessions, startOfLocalDay } from 'src/app/core/utils/sort-utils/sort.utils';

const ONE_DAY = 86_400_000;

export interface SeasonProgress {
  weeksCompleted: number;
  weeksScheduled: number;
  /** 0..1 (0 when nothing scheduled). */
  fraction: number;
  percent: number;
}

@Injectable({ providedIn: 'root' })
export class SeasonService {
  /**
   * Builds weekly sessions from a flat list of games (one session per league night),
   * numbered chronologically. The bowler is assumed `present` for played nights.
   */
  buildSessionsFromGames(games: Game[], numberOfGamesPerNight = 3): WeeklySession[] {
    return groupGamesIntoSessions(games).map((session, index) => ({
      id: generateId('ws'),
      weekNumber: index + 1,
      date: session.date,
      gamesScheduled: numberOfGamesPerNight,
      gamesBowled: session.games.length,
      attendance: 'present',
      gameIds: session.games.map((g) => g.gameId),
    }));
  }

  /** Creates a season populated from existing games (used by migration + manual import). */
  createSeasonFromGames(seasonNumber: number, seasonName: string, games: Game[], numberOfGamesPerNight = 3, partial: Partial<Season> = {}): Season {
    const sessions = this.buildSessionsFromGames(games, numberOfGamesPerNight);
    const dates = sessions.map((s) => s.date);
    return createSeason(generateId('sea'), seasonNumber, seasonName, {
      startDate: dates.length ? Math.min(...dates) : undefined,
      endDate: dates.length ? Math.max(...dates) : undefined,
      sessions,
      weeksScheduled: sessions.length,
      weeksCompleted: sessions.length,
      active: false,
      completed: true,
      ...partial,
    });
  }

  /**
   * Folds a single game into the right weekly session of a season (mutates the season):
   * the session for that calendar day, or a new one if there isn't one yet. Sessions are
   * re-sorted and re-numbered chronologically and `weeksCompleted` is kept in sync.
   * Idempotent — adding the same game twice is a no-op. Returns the session id used.
   */
  foldGameIntoSeason(season: Season, game: Game, numberOfGamesPerNight = 3): string {
    const day = startOfLocalDay(game.date);
    let session = season.sessions.find((s) => startOfLocalDay(s.date) === day);
    if (!session) {
      session = {
        id: generateId('ws'),
        weekNumber: season.sessions.length + 1,
        date: day,
        gamesScheduled: numberOfGamesPerNight,
        gamesBowled: 0,
        attendance: 'present',
        gameIds: [],
      };
      season.sessions.push(session);
    }
    if (!session.gameIds.includes(game.gameId)) {
      session.gameIds.push(game.gameId);
      session.gamesBowled = session.gameIds.length;
    }
    season.sessions.sort((a, b) => a.date - b.date);
    season.sessions.forEach((s, i) => (s.weekNumber = i + 1));

    season.weeksCompleted = season.sessions.length;
    if (season.weeksScheduled < season.sessions.length) {
      season.weeksScheduled = season.sessions.length;
    }
    const dates = season.sessions.map((s) => s.date);
    season.startDate = season.startDate ?? Math.min(...dates);
    season.endDate = Math.max(season.endDate ?? 0, ...dates);
    return session.id;
  }

  getActiveSeason(league: League): Season | undefined {
    return league.seasons.find((s) => s.active) ?? league.seasons[league.seasons.length - 1];
  }

  /** The season whose date window contains `date`, else the active / most-recent season. */
  seasonForDate(league: League, date: number): Season | undefined {
    const match = league.seasons.find((s) => (s.startDate == null || date >= s.startDate) && (s.endDate == null || date <= s.endDate));
    return match ?? this.getActiveSeason(league);
  }

  getCurrentSeason(league: League): Season | undefined {
    return this.getActiveSeason(league);
  }

  seasonProgress(season: Season | undefined): SeasonProgress {
    const weeksScheduled = season?.weeksScheduled ?? 0;
    const weeksCompleted = season?.weeksCompleted ?? 0;
    const fraction = weeksScheduled > 0 ? Math.min(1, weeksCompleted / weeksScheduled) : 0;
    return { weeksCompleted, weeksScheduled, fraction, percent: Math.round(fraction * 100) };
  }

  /**
   * The next upcoming league night, honoring the league's schedule type:
   * - `custom`  : earliest of `customDates` at/after `from`.
   * - `monthly` : same day-of-month as the start date.
   * - `weekly`/`biweekly`: next matching `dayOfWeek` (biweekly aligns to `startDate`).
   * Returns null for inactive leagues or when there's nothing to compute from.
   */
  nextSessionDate(league: League, from: number = Date.now()): number | null {
    if (!league.active) {
      return null;
    }
    const type = league.scheduleType ?? 'weekly';

    if (type === 'custom') {
      const upcoming = (league.customDates ?? []).filter((d) => d >= from).sort((a, b) => a - b);
      return upcoming.length ? upcoming[0] : null;
    }

    if (type === 'monthly') {
      return this.nextMonthly(league, from);
    }

    return this.nextWeekly(league, from, type === 'biweekly');
  }

  private nextWeekly(league: League, from: number, biweekly: boolean): number | null {
    if (!league.dayOfWeek) {
      return null;
    }
    const targetDow = DAYS_OF_WEEK.indexOf(league.dayOfWeek); // 0 = Monday
    if (targetDow < 0) {
      return null;
    }
    const [hours, minutes] = (league.startTime ?? '00:00').split(':').map((n) => parseInt(n, 10) || 0);
    const next = new Date(from);
    next.setHours(hours, minutes, 0, 0);
    // JS getDay(): 0 = Sunday … 6 = Saturday. Convert to Monday-based 0..6.
    const currentDow = (next.getDay() + 6) % 7;
    let delta = (targetDow - currentDow + 7) % 7;
    if (delta === 0 && next.getTime() <= from) {
      delta = 7;
    }
    next.setDate(next.getDate() + delta);

    if (biweekly && league.startDate) {
      // Keep only every other week relative to the start date's week.
      const weeksApart = Math.round((this.startOfWeek(next.getTime()) - this.startOfWeek(league.startDate)) / (7 * ONE_DAY));
      if (((weeksApart % 2) + 2) % 2 === 1) {
        next.setDate(next.getDate() + 7);
      }
    }
    return next.getTime();
  }

  private nextMonthly(league: League, from: number): number {
    const [hours, minutes] = (league.startTime ?? '00:00').split(':').map((n) => parseInt(n, 10) || 0);
    const dayOfMonth = new Date(league.startDate ?? from).getDate();
    const candidate = new Date(from);
    candidate.setHours(hours, minutes, 0, 0);
    candidate.setDate(dayOfMonth);
    if (candidate.getTime() <= from) {
      candidate.setMonth(candidate.getMonth() + 1);
      candidate.setDate(dayOfMonth);
    }
    return candidate.getTime();
  }

  private startOfWeek(timestamp: number): number {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // Monday-based
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }

  /**
   * Advances a league to a fresh season: the current active season is closed (marked
   * completed) and a new active season is appended, carrying over the previous fee
   * structure. Returns a new League — persist it via the store.
   */
  startNewSeason(league: League, seasonName?: string, partial: Partial<Season> = {}): League {
    const now = Date.now();
    const closed = league.seasons.map((s) => (s.active ? { ...s, active: false, completed: true, endDate: s.endDate ?? now } : s));
    const nextNumber = closed.reduce((max, s) => Math.max(max, s.seasonNumber), 0) + 1;
    const carriedFees = { ...(this.getActiveSeason(league)?.fees ?? createEmptyFeeStructure()) };
    const newSeason = createSeason(generateId('sea'), nextNumber, seasonName?.trim() || `Season ${nextNumber}`, {
      active: true,
      completed: false,
      startDate: now,
      fees: carriedFees,
      ...partial,
    });
    return { ...league, active: true, seasons: [...closed, newSeason] };
  }

  /** Whole days until the next league night, or null when none is scheduled. */
  countdownDays(league: League, from: number = Date.now()): number | null {
    const next = this.nextSessionDate(league, from);
    if (next === null) {
      return null;
    }
    return Math.max(0, Math.ceil((next - from) / 86_400_000));
  }
}
