import { Directive } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';

export interface GameCardContext {
  game: Game;
  inSeries: boolean;
  /** Card headline: league/'Practice', 'Game N' (league page), or '#N' inside a series */
  title: string;
  /** Pattern text for the meta line; empty hides the line */
  meta: string;
  /** Game number shown after the date (e.g. '#586'); empty when in the title or in a series */
  numberTag: string;
}

/**
 * Types the context of the game-card ng-template so strict template checking
 * applies inside it (ngTemplateOutlet contexts are otherwise untyped).
 */
@Directive({
  selector: 'ng-template[appGameCard]',
  standalone: true,
})
export class GameCardTemplateDirective {
  static ngTemplateContextGuard(_dir: GameCardTemplateDirective, ctx: unknown): ctx is GameCardContext {
    return true;
  }
}
