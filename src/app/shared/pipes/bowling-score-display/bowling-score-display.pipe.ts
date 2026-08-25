// bowling-score-display.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

import { Frame } from 'src/app/core/models/game.model';
import { getThrowValue } from 'src/app/core/utils/game-utils/frame.utils';

@Pipe({
  name: 'bowlingScoreDisplay',
  standalone: true,
})
export class BowlingScoreDisplayPipe implements PipeTransform {
  transform(frame: Frame, throwIndex: number, frameIndex: number): string {
    if (!frame) return '';

    const val = getThrowValue(frame, throwIndex);
    if (val === undefined || val === null) return '';

    const firstBall = getThrowValue(frame, 0);
    const isTenth = frameIndex === 9;

    // Normal Frame (1-9) Logic
    if (!isTenth) {
      if (throwIndex === 0) return val === 10 ? 'X' : val.toString();
      if (throwIndex === 1) return firstBall !== undefined && firstBall + val === 10 ? '/' : val.toString();
      return val.toString();
    }

    // 10th Frame Logic
    const secondBall = getThrowValue(frame, 1);
    if (throwIndex === 0) return val === 10 ? 'X' : val.toString();
    if (throwIndex === 1) {
      if (firstBall === 10) return val === 10 ? 'X' : val.toString(); // Strike then Strike
      return firstBall !== undefined && firstBall + val === 10 ? '/' : val.toString(); // Spare
    }
    if (throwIndex === 2) {
      if (secondBall === 10 || (firstBall === 10 && secondBall !== undefined && secondBall !== 10 && secondBall + val === 10)) {
        // XX or X then Spare logic? (Standard logic: X X X or X 4 /)
        // Actually, if ball 2 was a strike (after ball 1 strike), ball 3 can be strike.
        // If ball 2 was spare, ball 3 is number or strike.
        // Simplified check:
        return val === 10 ? 'X' : val.toString(); // Usually last ball is X or number
      }
      // Check for spare in 2nd/3rd ball combo if 1st was Strike
      if (firstBall === 10 && secondBall !== undefined && secondBall < 10 && secondBall + val === 10) return '/';

      return val.toString();
    }
    return val.toString();
  }
}
