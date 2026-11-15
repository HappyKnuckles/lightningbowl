import { Ball } from 'src/app/core/models/ball.model';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { formatLayout } from 'src/app/core/utils/drill-utils/drill.utils';
import { findBall, formatThrowBall, getThrowBallKey } from 'src/app/core/utils/game-utils/game-ball.utils';
import { ballKey } from './stored-ball.utils';

/** A ball in the arsenal: one physical ball, with its own id. */
export type ArsenalBall = Ball & { arsenalId: string };

/** A new id for an arsenal ball. */
export function newArsenalId(): string {
  // randomUUID needs a secure context, which a dev server opened over the network isn't
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * What belongs to the bowler's own ball rather than to the catalog ball: these survive when the
 * catalog data is replaced (a refresh from the ball API, a change of weight).
 */
export function ownBallFields(ball: Ball): Pick<Ball, 'arsenalId' | 'position' | 'drilling' | 'nickname' | 'note' | 'retiredAt'> {
  return {
    arsenalId: ball.arsenalId,
    position: ball.position,
    drilling: ball.drilling,
    nickname: ball.nickname,
    note: ball.note,
    retiredAt: ball.retiredAt,
  };
}

/** Whether an arsenal ball is retired: kept, but no longer offered when picking balls. */
export function isRetired(ball: Pick<Ball, 'retiredAt'>): boolean {
  return !!ball.retiredAt;
}

/** The arsenal's other balls of the same model and weight, the ball itself included, in arsenal order. */
function twinsOf(ball: Ball, arsenal: Ball[]): Ball[] {
  const key = ballKey(ball);
  return arsenal.filter((other) => ballKey(other) === key);
}

/** Whether the arsenal already has this ball in this weight. */
export function isInArsenal(ball: Ball, arsenal: Ball[]): boolean {
  return twinsOf(ball, arsenal).length > 0;
}

/**
 * What tells an arsenal ball apart: its nickname when it has one. Else, for the same ball owned
 * twice, its layout when the twins are drilled differently, or its number among them ("#2").
 * Empty for a ball without a nickname that is owned once.
 */
export function twinLabel(ball: Ball, arsenal: Ball[]): string {
  if (ball.nickname) return ball.nickname;
  const twins = twinsOf(ball, arsenal);
  if (twins.length < 2) return '';
  const layout = formatLayout(ball.drilling?.layout);
  const sameLayout = twins.filter((twin) => formatLayout(twin.drilling?.layout) === layout).length;
  if (layout && sameLayout === 1) return layout;
  return `#${twins.findIndex((twin) => twin.arsenalId === ball.arsenalId) + 1}`;
}

/**
 * An arsenal ball as shown in lists and pickers: "Phaze II 15lbs", with its nickname or what tells it
 * apart from its twin after it ("Phaze II 15lbs · benchmark", "Phaze II 15lbs · 45° × 4" × 30°").
 */
export function arsenalBallLabel(ball: Ball, arsenal: Ball[]): string {
  const name = `${ball.ball_name} ${ball.core_weight}lbs`;
  const twin = twinLabel(ball, arsenal);
  return twin ? `${name} · ${twin}` : name;
}

/** A game's ball as shown to the user: its arsenal ball's label when it is one, else name and weight. */
export function gameBallLabel(ball: ThrowBall | undefined, arsenal: Ball[]): string {
  if (!ball?.name) return '';
  const entry = ball.arsenalId ? arsenal.find((b) => b.arsenalId === ball.arsenalId) : undefined;
  if (!entry) return formatThrowBall(ball);
  // name and weight as the game recorded them (the arsenal ball may have changed weight since)
  const twin = twinLabel(entry, arsenal);
  return twin ? `${formatThrowBall(ball)} · ${twin}` : formatThrowBall(ball);
}

/**
 * Labels for the balls of a saved game, on the game or on its throws: name and weight with the
 * layout the game was saved with ("Phaze II 15lbs · 45° × 4" × 30°"). A ball the game recorded no
 * layout for falls back to `gameBallLabel`.
 */
export function savedGameBallLabeler(game: Pick<Game, 'balls'>, arsenal: Ball[]): (ball: ThrowBall | undefined) => string {
  const recorded = new Map((game.balls ?? []).map((ball) => [getThrowBallKey(ball), formatLayout(ball.drilling?.layout)]));
  return (ball) => {
    if (!ball?.name) return '';
    const layout = recorded.get(getThrowBallKey(ball));
    return layout ? `${formatThrowBall(ball)} · ${layout}` : gameBallLabel(ball, arsenal);
  };
}

/** The image source for a game's ball: its arsenal ball, else any known ball of that name and weight. */
export function findGameBall(ball: ThrowBall | undefined, arsenal: Ball[], known: Ball[] = []): Ball | undefined {
  return findBall(ball, arsenal) ?? findBall(ball, known);
}
