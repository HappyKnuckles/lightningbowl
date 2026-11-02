import { Game } from '../../models/game.model';
import { HandicapRule, League } from '../../models/league.model';
import { isInRange, seasonRanges, startOfDay } from './league.utils';

/** (basis − average) × percentage, rounded down, never below 0 and at most the rule's max. */
export function handicapFromAverage(rule: HandicapRule, average: number): number {
  const handicap = Math.floor(Math.max(0, rule.basis - Math.floor(average)) * (rule.percentage / 100));
  return rule.max !== undefined ? Math.min(handicap, rule.max) : handicap;
}

/**
 * The handicap of every game played in an event with a handicap rule, by game id. A game gets the
 * handicap of the average before its day, in its season when the league has seasons; until there
 * is such an average, the rule's starting average is used, and without one there is no handicap.
 */
export function calculateHandicaps(games: Game[], leagues: ReadonlyMap<string, League>): Map<string, number> {
  const handicaps = new Map<string, number>();
  const gamesByLeague = new Map<string, Game[]>();
  for (const game of games) {
    const rule = game.league ? leagues.get(game.league)?.handicap : undefined;
    if (!rule) continue;
    gamesByLeague.set(game.league!, [...(gamesByLeague.get(game.league!) ?? []), game]);
  }

  for (const [name, leagueGames] of gamesByLeague) {
    const league = leagues.get(name)!;
    const rule = league.handicap!;
    const ranges = league.seasons.length ? seasonRanges(league) : [{}];
    for (const range of ranges) {
      const seasonGames = leagueGames.filter((game) => isInRange(game.date, range)).sort((a, b) => a.date - b.date);
      let pins = 0;
      let count = 0;
      let index = 0;
      while (index < seasonGames.length) {
        const day = startOfDay(seasonGames[index].date);
        const average = count > 0 ? pins / count : rule.startingAverage;
        const sameDay = [];
        while (index < seasonGames.length && startOfDay(seasonGames[index].date) === day) sameDay.push(seasonGames[index++]);
        for (const game of sameDay) {
          if (average !== undefined) handicaps.set(game.gameId, handicapFromAverage(rule, average));
          pins += game.totalScore;
          count++;
        }
      }
    }
  }
  return handicaps;
}

/** A valid rule from what is stored or entered; undefined when there is no usable basis or percentage. */
export function normalizeHandicap(value: unknown): HandicapRule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const stored = value as Partial<Record<keyof HandicapRule, unknown>>;
  const number = (entry: unknown) => (typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 ? entry : undefined);
  const basis = number(stored.basis);
  const percentage = number(stored.percentage);
  if (!basis || !percentage) return undefined;
  const rule: HandicapRule = { basis, percentage: Math.min(percentage, 100) };
  const max = number(stored.max);
  const startingAverage = number(stored.startingAverage);
  if (max !== undefined) rule.max = max;
  if (startingAverage !== undefined) rule.startingAverage = startingAverage;
  return rule;
}
