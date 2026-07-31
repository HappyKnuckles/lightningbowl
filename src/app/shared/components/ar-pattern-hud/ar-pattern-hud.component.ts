import { Component, input, output } from '@angular/core';
import { IonChip, IonLabel } from '@ionic/angular/standalone';
import { Pattern } from 'src/app/core/models/pattern.model';

/**
 * The bottom sheet over the camera: which pattern is showing, how good the
 * anchor is, and a scrolling picker to swap patterns without recalibrating.
 */
@Component({
  selector: 'app-ar-pattern-hud',
  templateUrl: './ar-pattern-hud.component.html',
  styleUrl: './ar-pattern-hud.component.scss',
  imports: [IonChip, IonLabel],
})
export class ArPatternHudComponent {
  readonly pattern = input<Pattern | null>(null);
  readonly patterns = input<Partial<Pattern>[]>([]);
  readonly confidence = input(0);

  readonly patternSelected = output<string>();

  /** Anchor quality, stated in words rather than a bare number. */
  trackingLabel(): string {
    const confidence = this.confidence();
    if (confidence >= 0.7) {
      return 'Anchor locked';
    }

    return confidence >= 0.35 ? 'Anchor usable' : 'Anchor weak — recalibrate';
  }

  trackingColor(): string {
    const confidence = this.confidence();
    if (confidence >= 0.7) {
      return 'success';
    }

    return confidence >= 0.35 ? 'warning' : 'danger';
  }

  onSelect(url: string | undefined): void {
    if (url) {
      this.patternSelected.emit(url);
    }
  }
}
