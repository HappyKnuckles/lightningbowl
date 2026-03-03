import { Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { NgStyle } from '@angular/common';

@Component({
  selector: 'app-game-score-toolbar',
  templateUrl: './game-score-toolbar.component.html',
  styleUrls: ['./game-score-toolbar.component.scss'],
  imports: [IonButton, NgStyle],
})
export class GameScoreToolbarComponent {
  // Inputs
  show = input<boolean>(false);
  offset = input<number>(0);
  strikeDisabled = input<boolean>(false);
  spareDisabled = input<boolean>(false);

  // Outputs
  strikeClick = output<void>();
  spareClick = output<void>();

  onStrikeClick(): void {
    this.strikeClick.emit();
  }

  onSpareClick(): void {
    this.spareClick.emit();
  }
}
