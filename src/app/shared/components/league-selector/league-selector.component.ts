import { Component, computed, inject, input, model, output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlertController, SelectChangeEventDetail } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { IonSelectCustomEvent } from '@ionic/core';
import { addIcons } from 'ionicons';
import { addOutline, createOutline, trophyOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';

@Component({
  selector: 'app-league-selector',
  templateUrl: './league-selector.component.html',
  styleUrls: ['./league-selector.component.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonTitle,
    IonHeader,
    IonButtons,
    IonToolbar,
    IonModal,
    IonIcon,
    IonItem,
    IonButton,
    IonInput,
    IonSelect,
    FormsModule,
    ReactiveFormsModule,
    IonSelectOption,
  ],
})
export class LeagueSelectorComponent {
  isAddPage = input<boolean>(false);
  selectedLeague = model<string>('');
  icon = input<string>('');
  leagues = input<string[]>([]);
  leagueChanged = output<string>();

  newLeague = '';
  leaguesToDelete: string[] = [];
  leagueToChange = '';
  isModalOpen = false;

  selectableLeagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagues();
    if (this.isAddPage()) {
      this.hiddenLeagueSelectionService.selectionState();
      const savedJson = localStorage.getItem('leagueSelection');
      if (!savedJson) {
        return savedLeagues;
      }
      const savedSelection: Record<string, boolean> = JSON.parse(savedJson);
      return savedLeagues.filter((league) => savedSelection[league] !== false);
    } else {
      return this.leagues();
    }
  });
  private analyticsService = inject(AnalyticsService);
  constructor(
    public leaguesStore: LeaguesStore,
    private appFacade: AppFacade,
    private toastService: ToastService,
    private alertController: AlertController,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
  ) {
    addIcons({ trophyOutline, addOutline, createOutline });
  }

  async onLeagueChange(event: IonSelectCustomEvent<SelectChangeEventDetail>): Promise<void> {
    const value = event.detail.value;
    const previous = this.selectedLeague();

    if (value === 'edit') {
      this.isModalOpen = true;
      return;
    }
    if (value === 'delete') {
      await this.openDeleteAlert();
      return;
    }

    if (value === 'new') {
      const created = await this.openAddAlert();
      // Keep the previous selection when the user cancels instead of clearing it.
      this.selectedLeague.set(created ?? previous);
    } else {
      this.selectedLeague.set(value);
    }

    this.leagueChanged.emit(this.selectedLeague());
  }

  cancel(): void {
    this.leaguesToDelete = [];
    this.isModalOpen = false;
  }

  async editLeague(): Promise<void> {
    try {
      await this.appFacade.editLeague(this.newLeague, this.leagueToChange);
      this.newLeague = '';
      this.leagueToChange = '';
      this.toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
      this.isModalOpen = false;
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.leagueEditError, 'bug', true);
    }
  }

  private async deleteLeague(): Promise<void> {
    try {
      for (const league of this.leaguesToDelete) {
        await this.leaguesStore.deleteLeague(league);
      }
      this.toastService.showToast(TOAST_MESSAGES.leagueDeleteSuccess, 'checkmark-outline');
      this.isModalOpen = false;
    } catch (error) {
      console.error(error);
      this.toastService.showToast(TOAST_MESSAGES.leagueDeleteError, 'bug', true);
    }
  }

  private async openDeleteAlert(): Promise<void> {
    await this.alertController
      .create({
        header: 'Delete League',
        message: 'Select the leagues to delete',
        inputs: this.leaguesStore.leagues().map((league) => ({
          name: league,
          type: 'checkbox',
          label: league,
          value: league,
        })),
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            handler: async (data: string[]) => {
              this.leaguesToDelete = data;
              await this.deleteLeague();
            },
          },
        ],
      })
      .then((alert) => alert.present());
  }

  private async openAddAlert(): Promise<void> {
    await this.alertController
      .create({
        header: 'Add League',
        message: 'Enter the league name',
        inputs: [{ name: 'league', type: 'text', placeholder: 'League name', cssClass: 'league-alert-input' }],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Add',
            handler: (data) => this.createLeague(data.league),
          },
        ],
      })
      .then((alert) => alert.present());
  }

  private async createLeague(name: string): Promise<string | null> {
    const league = name?.trim();
    if (!league) return null;
    try {
      await this.leaguesStore.addLeague(league);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
      this.analyticsService.trackLeagueCreated({ name: league });
      return league;
    } catch (error) {
      console.error('Error adding league:', error);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveError, 'bug', true);
      return null;
    }
  }
}
