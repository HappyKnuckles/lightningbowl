import { Ball } from 'src/app/core/models/ball.model';
import { ThrowBall } from 'src/app/core/models/game.model';
import { ballKey } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { getBallModelKey, toThrowBall } from 'src/app/core/utils/game-utils/game-ball.utils';

/** What the ball typeahead of one game starts with. */
export interface BallPicker {
  /** The arsenal plus the game's own balls that aren't in it. */
  items: Ball[];
  /** The game's balls, by `ballKey`, as the typeahead identifies them. */
  selected: string[];
}

/** One ball per ball and weight, the first one winning. */
function onePerModel(balls: Ball[]): Ball[] {
  const byKey = new Map<string, Ball>();
  for (const ball of balls) {
    if (!byKey.has(ballKey(ball))) byKey.set(ballKey(ball), ball);
  }
  return [...byKey.values()];
}

const modelOf = (ball: Ball) => getBallModelKey({ name: ball.ball_name, weight: ball.core_weight });

/**
 * The typeahead's list before a search, for a game with these balls. A ball that has
 * left the arsenal must still be listed, or it starts out unselected and the next pick removes it
 * from the game. The typeahead searches the catalog, so it lists a ball owned twice once (which
 * of the two was thrown is picked in the arsenal list, see `pickedGameBalls`).
 */
export function ballPickerFor(balls: ThrowBall[] | undefined, arsenal: Ball[], knownBalls: Ball[]): BallPicker {
  const used = new Set((balls ?? []).map(getBallModelKey));
  const own = used.size ? onePerModel(knownBalls).filter((ball) => used.has(modelOf(ball))) : [];
  const ownedKeys = new Set(arsenal.map(ballKey));
  const notInArsenal = own.filter((ball) => !ownedKeys.has(ballKey(ball)));
  return { items: [...onePerModel(arsenal), ...notInArsenal], selected: own.map(ballKey) };
}

/**
 * A game's balls after picking `picked` in the typeahead. A ball the game already had stays exactly
 * as it was (which arsenal ball it is, and the layout recorded with it); a new one becomes the
 * arsenal's ball of that model and weight when there is one.
 */
export function pickedGameBalls(picked: Ball[], current: ThrowBall[] | undefined, arsenal: Ball[]): ThrowBall[] {
  return picked.flatMap((ball): ThrowBall[] => {
    const kept = (current ?? []).filter((stored) => getBallModelKey(stored) === modelOf(ball));
    if (kept.length) return kept;
    return [toThrowBall(arsenal.find((entry) => ballKey(entry) === ballKey(ball)) ?? ball)];
  });
}
