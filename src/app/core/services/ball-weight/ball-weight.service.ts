import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { Ball, BallWeightQuestion } from 'src/app/core/models/ball.model';
import { StorageKeys } from 'src/app/core/services/storage/storage-keys';
import { StorageRepository } from 'src/app/core/services/storage/storage.repository';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { ballKey } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { applyBallWeights, isWeightless, weightlessBallNames } from 'src/app/core/utils/game-utils/ball.utils';
import { BallWeightPickerComponent } from 'src/app/shared/components/ball-weight-picker/ball-weight-picker.component';

/**
 * The weight of a ball stored by name alone is never guessed: the bowler is asked. Imports ask
 * for the balls a file names without a weight; at startup, games saved that way are asked about
 * once.
 */
@Injectable({ providedIn: 'root' })
export class BallWeightService {
  constructor(
    private modalCtrl: ModalController,
    private ballsStore: BallsStore,
    private gamesStore: GamesStore,
    private storageRepository: StorageRepository,
  ) {}

  /**
   * Asks which weight each name without one means. Returns lower-cased names mapped to the picked
   * balls; skipped names, and names of balls the app doesn't know, are missing. A ball the catalog
   * has in a single weight needs no question.
   */
  async askWeights(names: string[], confirmText = 'Save'): Promise<Map<string, Ball>> {
    const chosen = new Map<string, Ball>();
    const weightless = [...new Set(names.filter((name) => isWeightless(name)).map((name) => name.trim()))];
    if (weightless.length === 0) return chosen;

    const { options, complete } = await this.ballsStore.weightOptions(weightless);
    const questions: BallWeightQuestion[] = [];
    for (const [name, variants] of options) {
      if (variants.length === 0) continue;
      if (variants.length === 1 && complete) {
        chosen.set(name.toLowerCase(), variants[0]);
        continue;
      }
      const owned = variants.find((variant) => this.ballsStore.arsenal().some((ball) => ballKey(ball) === ballKey(variant)));
      questions.push({ name, options: variants, owned });
    }

    if (questions.length > 0) {
      const modal = await this.modalCtrl.create({
        component: BallWeightPickerComponent,
        componentProps: { questions, confirmText },
        backdropDismiss: false,
        // above sheets the current page presents later (the add page's pin input)
        cssClass: 'ball-weight-modal',
      });
      await modal.present();
      const { data } = await modal.onWillDismiss<Map<string, Ball>>();
      for (const [name, ball] of data ?? []) chosen.set(name, ball);
      await this.rememberSkipped(questions.map((question) => question.name).filter((name) => !chosen.has(name.toLowerCase())));
    }

    // picked balls may come from the API: keep them resolvable offline
    await this.ballsStore.rememberBalls([...chosen.values()]);
    return chosen;
  }

  /**
   * Asks, once per name, the weight of balls that games on the device store without one (games
   * from before weights were saved, PinPal imports), and writes the picked weights into them.
   */
  async askForStoredGames(): Promise<void> {
    const skipped = new Set(await this.loadSkipped());
    const names = [...new Set(this.gamesStore.games().flatMap((game) => weightlessBallNames(game)))].filter(
      (name) => !skipped.has(name.toLowerCase()),
    );
    if (names.length === 0) return;

    const chosen = await this.askWeights(names);
    if (chosen.size === 0) return;
    for (const game of this.gamesStore.games()) {
      const updated = applyBallWeights(game, chosen);
      if (updated !== game) await this.gamesStore.saveGameToLocalStorage(updated);
    }
  }

  private async loadSkipped(): Promise<string[]> {
    try {
      return (await this.storageRepository.get<string[]>(StorageKeys.ballWeightSkipped)) ?? [];
    } catch (error) {
      console.error('Error loading skipped ball weights:', error);
      return [];
    }
  }

  private async rememberSkipped(names: string[]): Promise<void> {
    if (names.length === 0) return;
    try {
      const skipped = new Set([...(await this.loadSkipped()), ...names.map((name) => name.toLowerCase())]);
      await this.storageRepository.set(StorageKeys.ballWeightSkipped, [...skipped]);
    } catch (error) {
      console.error('Error saving skipped ball weights:', error);
    }
  }
}
