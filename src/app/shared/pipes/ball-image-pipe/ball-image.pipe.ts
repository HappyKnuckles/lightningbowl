import { Pipe, PipeTransform } from '@angular/core';
import { Ball } from 'src/app/core/models/ball.model';
import { BallImageKind, ballImageUrl } from 'src/app/core/utils/ball-utils/ball-image.utils';

/** `ball | ballImage` / `ball | ballImage: 'core'`: an absolute image URL, or a placeholder. */
@Pipe({
  name: 'ballImage',
  standalone: true,
})
export class BallImagePipe implements PipeTransform {
  transform(ball: Ball | null | undefined, kind: BallImageKind = 'thumbnail'): string {
    return ballImageUrl(ball, kind);
  }
}
