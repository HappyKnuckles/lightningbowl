import { ALL_BOWLERS } from '../../models/bowler.model';
import { Game } from '../../models/game.model';

/**
 * Resolves which bowler a game belongs to. Games saved before the bowler
 * migration (or by an old app version) have no bowlerId and belong to the
 * default bowler.
 */
export function getGameBowlerId(game: Game, defaultBowlerId: string): string {
  return game.bowlerId ?? defaultBowlerId;
}

/**
 * Scopes games to a bowler selection. A selection containing ALL_BOWLERS
 * (or an empty selection) matches everything.
 */
export function filterGamesByBowlers(games: Game[], selectedBowlerIds: string[], defaultBowlerId: string): Game[] {
  if (selectedBowlerIds.length === 0 || selectedBowlerIds.includes(ALL_BOWLERS)) {
    return games;
  }
  return games.filter((game) => selectedBowlerIds.includes(getGameBowlerId(game, defaultBowlerId)));
}
