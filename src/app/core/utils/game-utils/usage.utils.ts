import { ArsenalBall, Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';

export interface UsageStats {
  count: number;
  lastUsed: number;
}

/**
 * Count how often each ball was thrown across all games, keyed like ThrowBall keys ("Name{weight}").
 */
export function countBallUsage(games: readonly Game[]): Map<string, UsageStats> {
  const usage = new Map<string, UsageStats>();
  for (const game of games) {
    for (const key of game.balls ?? []) {
      bump(usage, key, game.date);
    }
  }
  return usage;
}

/**
 * Count how often each pattern was played across all games, keyed by pattern title.
 */
export function countPatternUsage(games: readonly Game[]): Map<string, UsageStats> {
  const usage = new Map<string, UsageStats>();
  for (const game of games) {
    for (const title of game.patterns ?? []) {
      bump(usage, title, game.date);
    }
  }
  return usage;
}

/**
 * Sort items by usage: most used first, ties broken by most recently used.
 * Unused items keep their relative order (stable sort).
 */
export function rankByUsage<T>(items: readonly T[], usage: Map<string, UsageStats>, keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const usageA = usage.get(keyFn(a));
    const usageB = usage.get(keyFn(b));
    const countDiff = (usageB?.count ?? 0) - (usageA?.count ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return (usageB?.lastUsed ?? 0) - (usageA?.lastUsed ?? 0);
  });
}

/**
 * Arsenal sorted by how often each ball was thrown, most used first, labelled for selection lists.
 * Games reference balls by name only, so a ball owned at several weights collapses to one entry.
 */
export function rankArsenalForSelection(arsenal: readonly Ball[], games: readonly Game[]): ArsenalBall[] {
  const usage = countBallUsage(games);
  const seen = new Set<string>();
  return rankByUsage(arsenal, usage, (ball) => ball.ball_name + ball.core_weight)
    .filter((ball) => {
      if (seen.has(ball.ball_name)) return false;
      seen.add(ball.ball_name);
      return true;
    })
    .map((ball) => ({ ...ball, ball_label: `${ball.ball_name} ${ball.core_weight}lbs` }));
}

function bump(usage: Map<string, UsageStats>, key: string, date: number): void {
  const entry = usage.get(key);
  if (entry) {
    entry.count += 1;
    entry.lastUsed = Math.max(entry.lastUsed, date);
  } else {
    usage.set(key, { count: 1, lastUsed: date });
  }
}
