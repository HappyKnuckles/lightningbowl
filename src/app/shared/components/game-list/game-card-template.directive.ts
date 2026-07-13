import { Directive } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';

export interface GameCardContext {
  game: Game;
  inSeries: boolean;
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
