import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternTextureService } from 'src/app/core/services/pattern-texture/pattern-texture.service';
import { OilModel, toLoadRects } from 'src/app/core/utils/pattern-utils/oil-map.utils';

/**
 * Renders a pattern's oil distribution from its load data.
 *
 * This draws the same geometry as the stored chart images, from the same
 * numbers, but as live canvas so it can be recoloured, compared and reused as
 * the AR overlay texture.
 */
@Component({
  selector: 'app-pattern-canvas',
  imports: [],
  templateUrl: './pattern-canvas.component.html',
  styleUrl: './pattern-canvas.component.scss',
})
export class PatternCanvasComponent {
  private readonly patternTextureService = inject(PatternTextureService);

  readonly pattern = input.required<Pattern>();
  readonly model = input<OilModel>('coverage');
  readonly showBoardNumbers = input(true);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const pattern = this.pattern();
      const model = this.model();
      const showBoardNumbers = this.showBoardNumbers();

      if (!canvas) {
        return;
      }

      this.draw(canvas, pattern, model, showBoardNumbers);
    });
  }

  /** True when the pattern carries no usable load rows. */
  hasNoLoadData(): boolean {
    return toLoadRects(this.pattern()).rects.length === 0;
  }

  private draw(canvas: HTMLCanvasElement, pattern: Pattern, model: OilModel, showBoardNumbers: boolean): void {
    const ratio = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 160;
    const cssHeight = Math.round(cssWidth * 2.4);

    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);

    this.patternTextureService.renderToCanvas(canvas, pattern, { model, showBoardNumbers });
  }
}
