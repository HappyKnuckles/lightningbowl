import { Component, input } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { IonCol, IonRow, IonGrid, IonLabel, IonChip } from '@ionic/angular/standalone';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pattern-info',
  imports: [IonChip, IonLabel, IonGrid, IonRow, IonCol],
  templateUrl: './pattern-info.component.html',
  styleUrl: './pattern-info.component.scss',
})
export class PatternInfoComponent {
  pattern = input.required<Pattern>();
  imagesUrl = environment.imagesUrl;

  getDifficulty() {
    const numericPart = this.pattern().ratio?.split(':')[0] || '0';
    const num = parseInt(numericPart, 10);
    if (num <= 4) {
      return 'Hard';
    } else if (num <= 8) {
      return 'Medium';
    } else {
      return 'Easy';
    }
  }

  getLength() {
    const length = parseInt(this.pattern().distance, 10);
    if (length <= 35) {
      return 'Short';
    } else if (length < 41) {
      return 'Medium';
    } else {
      return 'Long';
    }
  }

  getVolume() {
    const volume = parseInt(this.pattern().volume, 10);
    if (volume < 22) {
      return 'Light';
    } else if (volume <= 26) {
      return 'Medium';
    } else if (volume < 30) {
      return 'High';
    } else {
      return 'Very High';
    }
  }
}
