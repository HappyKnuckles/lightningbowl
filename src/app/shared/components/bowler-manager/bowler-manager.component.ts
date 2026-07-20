import { Component, computed, OnInit, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkOutline, createOutline, peopleOutline, trashOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Bowler } from 'src/app/core/models/bowler.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { BowlersStore } from 'src/app/core/stores/bowlers.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { getGameBowlerId } from 'src/app/core/utils/bowler-utils/bowler.utils';

@Component({
  selector: 'app-bowler-manager',
  templateUrl: './bowler-manager.component.html',
  styleUrls: ['./bowler-manager.component.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonModal,
    IonNote,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class BowlerManagerComponent implements OnInit {
  isPickerOpen = signal(false);
  presentingElement!: HTMLElement | null;

  readonly gameCounts = computed<Record<string, number>>(() => {
    const defaultId = this.bowlersStore.defaultBowlerId();
    const counts: Record<string, number> = {};
    for (const game of this.gamesStore.games()) {
      const bowlerId = getGameBowlerId(game, defaultId);
      counts[bowlerId] = (counts[bowlerId] ?? 0) + 1;
    }
    return counts;
  });

  readonly ballCounts = computed<Record<string, number>>(() => {
    const defaultId = this.bowlersStore.defaultBowlerId();
    const counts: Record<string, number> = {};
    for (const ball of this.ballsStore.arsenal()) {
      for (const bowlerId of ball.bowlerIds ?? [defaultId]) {
        counts[bowlerId] = (counts[bowlerId] ?? 0) + 1;
      }
    }
    return counts;
  });

  constructor(
    public bowlersStore: BowlersStore,
    private gamesStore: GamesStore,
    private ballsStore: BallsStore,
    private appFacade: AppFacade,
    private toastService: ToastService,
    private alertController: AlertController,
  ) {
    addIcons({ peopleOutline, addOutline, checkmarkOutline, createOutline, trashOutline });
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page');
  }

  openPicker(): void {
    this.isPickerOpen.set(true);
  }

  closePicker(): void {
    this.isPickerOpen.set(false);
  }

  setActive(bowler: Bowler): void {
    this.bowlersStore.setActiveBowler(bowler.bowlerId);
  }

  async openAddAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Add Bowler',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data: { name: string }) => {
            const name = data.name?.trim();
            if (!name || this.isNameTaken(name)) {
              return false;
            }
            void this.addBowler(name);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async openEditAlert(bowler: Bowler): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Edit Bowler',
      inputs: [{ name: 'name', type: 'text', value: bowler.name, placeholder: 'Name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data: { name: string }) => {
            const name = data.name?.trim();
            if (!name || (name !== bowler.name && this.isNameTaken(name))) {
              return false;
            }
            void this.renameBowler(bowler, name);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  // Bowler names must be unique: filters and Excel import/export match by name.
  private isNameTaken(name: string): boolean {
    const taken = this.bowlersStore.bowlers().some((b) => b.name.toLowerCase() === name.toLowerCase());
    if (taken) {
      this.toastService.showToast(TOAST_MESSAGES.bowlerNameTaken, 'bug', true);
    }
    return taken;
  }

  async openDeleteAlert(bowler: Bowler): Promise<void> {
    if (this.bowlersStore.bowlers().length <= 1) {
      this.toastService.showToast(TOAST_MESSAGES.lastBowlerDeleteError, 'bug', true);
      return;
    }

    const gameCount = this.gameCounts()[bowler.bowlerId] ?? 0;
    const ballCount = this.ballCounts()[bowler.bowlerId] ?? 0;

    if (gameCount === 0 && ballCount === 0) {
      const alert = await this.alertController.create({
        header: `Delete ${bowler.name}?`,
        message: `${bowler.name} has no games or balls.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Delete', role: 'destructive', handler: () => void this.deleteBowler(bowler) },
        ],
      });
      await alert.present();
      return;
    }

    const games = `${gameCount} ${gameCount === 1 ? 'game' : 'games'}`;
    const balls = `${ballCount} ${ballCount === 1 ? 'ball' : 'balls'}`;
    const alert = await this.alertController.create({
      header: `Delete ${bowler.name}?`,
      message: `${bowler.name} has ${games} and ${balls} in the arsenal.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Move data to…', handler: () => void this.openReassignAlert(bowler) },
        { text: 'Delete everything', role: 'destructive', handler: () => void this.openCascadeConfirmAlert(bowler, games) },
      ],
    });
    await alert.present();
  }

  private async openReassignAlert(bowler: Bowler): Promise<void> {
    const others = this.bowlersStore.bowlers().filter((b) => b.bowlerId !== bowler.bowlerId);
    const alert = await this.alertController.create({
      header: 'Move data to',
      inputs: others.map((other, index) => ({
        name: other.bowlerId,
        type: 'radio' as const,
        label: other.name,
        value: other.bowlerId,
        checked: index === 0,
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move & Delete',
          handler: (reassignToBowlerId: string) => {
            if (!reassignToBowlerId) {
              return false;
            }
            void this.deleteBowler(bowler, reassignToBowlerId);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async openCascadeConfirmAlert(bowler: Bowler, games: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Are you sure?',
      message: `This permanently deletes ${games} of ${bowler.name}. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete everything', role: 'destructive', handler: () => void this.deleteBowler(bowler) },
      ],
    });
    await alert.present();
  }

  private async addBowler(name: string): Promise<void> {
    try {
      await this.bowlersStore.addBowler(name);
      this.toastService.showToast(TOAST_MESSAGES.bowlerSaveSuccess, 'add');
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.bowlerSaveError, 'bug', true);
    }
  }

  private async renameBowler(bowler: Bowler, name: string): Promise<void> {
    try {
      await this.appFacade.renameBowler(bowler, name);
      this.toastService.showToast(TOAST_MESSAGES.bowlerEditSuccess, 'checkmark-outline');
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.bowlerEditError, 'bug', true);
    }
  }

  private async deleteBowler(bowler: Bowler, reassignToBowlerId?: string): Promise<void> {
    try {
      await this.appFacade.deleteBowler(bowler.bowlerId, reassignToBowlerId);
      this.toastService.showToast(
        reassignToBowlerId ? TOAST_MESSAGES.bowlerReassignSuccess : TOAST_MESSAGES.bowlerDeleteSuccess,
        'checkmark-outline',
      );
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.bowlerDeleteError, 'bug', true);
    }
  }
}
