import { Ball } from 'src/app/core/models/ball.model';
import { ballValueMatches } from 'src/app/core/utils/game-utils/ball.utils';

/** What the ball typeahead of one game starts with. */
export interface BallPicker {
  /** The arsenal plus the game's own balls that aren't in it. */
  items: Ball[];
  /** The game's balls, as the typeahead identifies them. */
  selected: string[];
}

/**
 * The typeahead's list before a search, for a game with these stored ball values. A ball that has
 * left the arsenal must still be listed, or it starts out unselected and the next pick removes it
 * from the game.
 */
export function ballPickerFor(names: string[] | undefined, arsenal: Ball[], knownBalls: Ball[]): BallPicker {
  const own = names?.length ? knownBalls.filter((ball) => names.some((name) => ballValueMatches(name, ball))) : [];
  const notInArsenal = own.filter((ball) => !arsenal.some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight));
  return { items: [...arsenal, ...notInArsenal], selected: own.map((ball) => ball.ball_id) };
}
