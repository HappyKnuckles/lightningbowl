import { formatDate } from '@angular/common';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { formatLayout, LAYOUT_SYSTEM_LABELS } from 'src/app/core/utils/drill-utils/drill.utils';
import { getGameBallLabels } from 'src/app/core/utils/game-utils/game-ball.utils';

const lines = (parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join('\n');

const isSet = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined && value !== '';

/** "Label: name, detail, detail" from the parts that are set; null when none is. */
const describe = (label: string, parts: (string | number | null | undefined)[]): string | null => {
  const set = parts.filter(isSet);
  return set.length ? `${label}: ${set.join(', ')}` : null;
};

/** The text that goes with a shared game: score and date, balls and patterns. */
export function buildGameShareMessage(game: Game, locale: string): string {
  const date = formatDate(game.date, 'dd.MM.yy', locale);
  const balls = getGameBallLabels(game);
  return lines([
    game.totalScore === 300 ? `Look at me bitches, perfect game on ${date}! 🎳🎉.` : `Check out this game from ${date}. A ${game.totalScore}.`,
    balls.length > 0 && `Bowled with: ${balls.join(', ')}`,
    !!game.patterns?.length && `Patterns: ${game.patterns.join(', ')}`,
  ]);
}

/**
 * The text that goes with a shared ball: name, brand and release, core and coverstock. For a ball from the
 * arsenal (`owned`) also its weight and layout.
 */
export function buildBallShareMessage(ball: Ball, owned = false): string {
  const brand = [ball.brand_name, ball.release_date && `(${ball.release_date})`].filter(Boolean).join(' ');
  const layout = formatLayout(ball.drilling?.layout);
  return lines([
    owned ? `In my bag: ${ball.ball_name}${brand ? ` by ${brand}` : ''} 🎳` : `Check out the ${ball.ball_name}${brand ? ` by ${brand}` : ''} 🎳`,
    owned && ball.core_weight && `Weight: ${ball.core_weight} lbs`,
    owned && layout && `Layout: ${LAYOUT_SYSTEM_LABELS[ball.drilling!.layout!.system]} ${layout}`,
    describe('Core', [
      ball.core_name,
      ball.core_type,
      isSet(ball.core_rg) ? `RG ${ball.core_rg}` : null,
      isSet(ball.core_diff) ? `Diff ${ball.core_diff}` : null,
      ball.core_int_diff ? `Int. Diff ${ball.core_int_diff}` : null,
    ]),
    describe('Coverstock', [ball.coverstock_name, ball.coverstock_type, ball.factory_finish]),
  ]);
}
