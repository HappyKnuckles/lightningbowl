import { Ball } from 'src/app/core/models/ball.model';
import { ThrowBall } from 'src/app/core/models/game.model';
import { ballKey } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { sameGameBall } from 'src/app/core/utils/game-utils/ball.utils';

/** What the ball typeahead of one game starts with. */
export interface BallPicker {
  /** The arsenal plus the game's own balls that aren't in it. */
  items: Ball[];
  /** The game's balls, by `ballKey`, as the typeahead identifies them. */
  selected: string[];
}

/**
 * The typeahead's list before a search, for a game with these balls. A ball that has
 * left the arsenal must still be listed, or it starts out unselected and the next pick removes it
 * from the game.
 */
export function ballPickerFor(balls: ThrowBall[] | undefined, arsenal: Ball[], knownBalls: Ball[]): BallPicker {
  const own = balls?.length
    ? knownBalls.filter((ball) => balls.some((stored) => sameGameBall(stored, { name: ball.ball_name, weight: ball.core_weight })))
    : [];
  const ownedKeys = new Set(arsenal.map(ballKey));
  const notInArsenal = own.filter((ball) => !ownedKeys.has(ballKey(ball)));
  return { items: [...arsenal, ...notInArsenal], selected: own.map(ballKey) };
}
