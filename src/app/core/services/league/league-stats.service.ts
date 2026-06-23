import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { League, Season } from 'src/app/core/models/league';
import { Stats } from 'src/app/core/models/stats.model';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';

export interface SeasonStatsView {
  season: Season;
  games: Game[];
  stats: Stats;
}

export interface CareerStatsView {
  stats: Stats;
  seasons: SeasonStatsView[];
  bestSeason?: SeasonStatsView;
  totalPins: number;
  /** Average-score delta between the most recent season and the one before it. */
  yearOverYearDelta?: number;
}

/**
 * Per-league / per-season / career statistics. A thin orchestration layer over the
 * existing GameStatsService so we reuse the exact same calculations everywhere.
 */
@Injectable({ providedIn: 'root' })
export class LeagueStatsService {
  constructor(private statsService: GameStatsService) {}

  /** Games belonging to a league, matched by relational id first, then by display name. */
  gamesForLeague(league: League, allGames: Game[]): Game[] {
    return allGames.filter((g) => (g.leagueId && g.leagueId === league.id) || (!g.leagueId && g.league === league.name));
  }

  gamesForSeason(season: Season, leagueGames: Game[]): Game[] {
    const sessionIds = new Set(season.sessions.map((s) => s.id));
    const sessionGameIds = new Set(season.sessions.flatMap((s) => s.gameIds));
    return leagueGames.filter(
      (g) => (g.seasonId && g.seasonId === season.id) || (g.sessionId && sessionIds.has(g.sessionId)) || sessionGameIds.has(g.gameId),
    );
  }

  statsForGames(games: Game[]): Stats {
    return this.statsService.calculateBowlingStats(games);
  }

  seasonStats(league: League, allGames: Game[]): SeasonStatsView[] {
    const leagueGames = this.gamesForLeague(league, allGames);
    return league.seasons.map((season) => {
      const games = this.gamesForSeason(season, leagueGames);
      return { season, games, stats: this.statsForGames(games) };
    });
  }

  careerStats(league: League, allGames: Game[]): CareerStatsView {
    const leagueGames = this.gamesForLeague(league, allGames);
    const stats = this.statsForGames(leagueGames);
    const seasons = this.seasonStats(league, allGames).filter((s) => s.games.length > 0);

    const bestSeason = seasons.reduce<SeasonStatsView | undefined>(
      (best, s) => (!best || s.stats.averageScore > best.stats.averageScore ? s : best),
      undefined,
    );

    const byDate = [...seasons].sort((a, b) => (a.season.startDate ?? 0) - (b.season.startDate ?? 0));
    const last = byDate[byDate.length - 1];
    const prev = byDate[byDate.length - 2];
    const yearOverYearDelta = last && prev ? last.stats.averageScore - prev.stats.averageScore : undefined;

    return { stats, seasons, bestSeason, totalPins: stats.totalPins, yearOverYearDelta };
  }
}
