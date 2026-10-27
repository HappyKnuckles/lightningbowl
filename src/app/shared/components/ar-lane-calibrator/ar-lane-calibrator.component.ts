import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { LaneCorrespondence } from 'src/app/core/models/ar.model';

/**
 * The manual calibration overlay: a ghosted chevron the user aligns to the
 * lane's arrows, tapping three of them.
 *
 * Arrows rather than lane corners, because the corners are 18 m away and a few
 * pixels wide — a 3 px tap error there swings the pose by degrees. The arrows
 * sit 12–16 ft out, and their staggered distances keep the three points
 * non-collinear, which the pose solve needs.
 */
@Component({
  selector: 'app-ar-lane-calibrator',
  templateUrl: './ar-lane-calibrator.component.html',
  styleUrl: './ar-lane-calibrator.component.scss',
  imports: [],
})
export class ArLaneCalibratorComponent {
  readonly taps = input<readonly LaneCorrespondence[]>([]);
  readonly tapped = output<{ x: number; y: number; index: number }>();

  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  /** Ghost targets, positioned to mirror the arrows' shallow chevron. */
  readonly targets = computed(() => {
    const count = this.taps().length;
    return [
      { label: 'Board 5', left: 22, top: 62, done: count > 0, active: count === 0 },
      { label: 'Board 20', left: 50, top: 55, done: count > 1, active: count === 1 },
      { label: 'Board 35', left: 78, top: 62, done: count > 2, active: count === 2 },
    ];
  });

  onTap(event: PointerEvent): void {
    const element = this.surface()?.nativeElement;
    const index = this.taps().length;
    if (!element || index > 2) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }

    this.tapped.emit({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
      index,
    });
  }
}
