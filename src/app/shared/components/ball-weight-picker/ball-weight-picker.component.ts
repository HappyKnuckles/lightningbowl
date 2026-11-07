import { Component, OnInit, signal } from '@angular/core';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { Ball, BallWeightQuestion } from 'src/app/core/models/ball.model';
import { ballKey } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';

interface WeightRow {
  name: string;
  ball: Ball;
  options: { value: string; label: string; ball: Ball }[];
}

/**
 * Asks which weight balls stored by name alone were. Opened by `BallWeightService`; dismisses with
 * a map of lower-cased names to the picked balls (role 'confirm'), or an empty map (role 'skip').
 */
@Component({
  selector: 'app-ball-weight-picker',
  imports: [
    BallImagePipe,
    IonAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './ball-weight-picker.component.html',
  styleUrls: ['./ball-weight-picker.component.scss'],
})
export class BallWeightPickerComponent implements OnInit {
  readonly rows = signal<WeightRow[]>([]);
  readonly #picked = signal<Record<string, string>>({});
  readonly picked = this.#picked.asReadonly();

  /** Set through the modal's `componentProps`. */
  questions: BallWeightQuestion[] = [];
  /** Set through the modal's `componentProps`. */
  confirmText = 'Save';

  constructor(private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.rows.set(
      this.questions.map((question) => ({
        name: question.name,
        ball: question.owned ?? question.options[0],
        options: question.options.map((ball) => ({ value: ballKey(ball), label: `${ball.core_weight} lbs`, ball })),
      })),
    );
    const owned: Record<string, string> = {};
    for (const question of this.questions) {
      if (question.owned) owned[question.name] = ballKey(question.owned);
    }
    this.#picked.set(owned);
  }

  pick(name: string, value: unknown): void {
    if (value === undefined || value === null) return;
    this.#picked.update((picked) => ({ ...picked, [name]: String(value) }));
  }

  skip(): Promise<boolean> {
    return this.modalCtrl.dismiss(new Map<string, Ball>(), 'skip');
  }

  confirm(): Promise<boolean> {
    const chosen = new Map<string, Ball>();
    for (const row of this.rows()) {
      const ball = row.options.find((option) => option.value === this.#picked()[row.name])?.ball;
      if (ball) chosen.set(row.name.toLowerCase(), ball);
    }
    return this.modalCtrl.dismiss(chosen, 'confirm');
  }
}
