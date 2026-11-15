import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';

import { BallsStore } from 'src/app/core/stores/balls.store';

/** Asks the bowler which of their arsenals something concerns. */
@Injectable({ providedIn: 'root' })
export class ArsenalPickerService {
  readonly #alertController = inject(AlertController);
  readonly #ballsStore = inject(BallsStore);

  /**
   * The arsenals (`Arsenal.id`) new balls should go into. With a single arsenal there is nothing to ask
   * and it is returned right away; else the bowler picks, with the open arsenal ticked. Null when
   * they cancel.
   */
  async chooseForNewBalls(): Promise<string[] | null> {
    const arsenals = this.#ballsStore.arsenals();
    const current = this.#ballsStore.currentArsenal()?.id;
    if (arsenals.length <= 1) return current ? [current] : [];
    return this.choose('Add to which arsenals?', current ? [current] : []);
  }

  /**
   * Lets the bowler tick arsenals, starting from `selected`. Resolves to the ticked ids, or null when
   * they cancel. Nothing ticked can't be confirmed: the dialog stays open.
   */
  async choose(header: string, selected: string[]): Promise<string[] | null> {
    const alert = await this.#alertController.create({
      header,
      inputs: this.#ballsStore.arsenals().map((arsenal) => ({
        type: 'checkbox' as const,
        label: arsenal.name,
        value: arsenal.id,
        checked: selected.includes(arsenal.id),
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'OK', role: 'confirm', handler: (ids: string[]) => ids.length > 0 },
      ],
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss<{ values?: string[] }>();
    return role === 'confirm' && data?.values?.length ? data.values : null;
  }
}
