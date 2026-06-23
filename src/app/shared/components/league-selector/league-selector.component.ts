import { Component, computed, inject, input, model, output, signal } from '@angular/core';
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
import { League } from 'src/app/core/models/league';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { LeagueFormComponent } from 'src/app/shared/components/league-form/league-form.component';

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
    LeagueFormComponent,
  ],
})
export class LeagueSelectorComponent {
  isAddPage = input<boolean>(false);
  selectedLeague = model<string>('');
  icon = input<string>('');
  leagues = input<string[]>([]);
  leagueChanged = output<string>();

  newLeague = signal('');
  leaguesToDelete: string[] = [];
  leagueToChange = signal('');
  isModalOpen = signal(false);
  isFormOpen = signal(false);

  selectableLeagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagueNames();
    this.hiddenLeagueSelectionService.selectionState();
    const savedJson = localStorage.getItem('leagueSelection');
    const savedSelection: Record<string, boolean> = savedJson ? JSON.parse(savedJson) : {};
    const visibleLeagues = savedLeagues.filter((league) => savedSelection[league] !== false);
    return [...new Set([...visibleLeagues, ...this.leagues()])];
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
      this.isModalOpen.set(true);
      return;
    }
    if (value === 'delete') {
      await this.openDeleteAlert();
      return;
    }

    if (value === 'new') {
      // Snap the select back to the previous value and open the rich league form.
      this.selectedLeague.set(previous);
      this.isFormOpen.set(true);
      return;
    } else {
      this.selectedLeague.set(value);
    }

    this.leagueChanged.emit(this.selectedLeague());
  }

  async onFormSaved(league: League): Promise<void> {
    this.isFormOpen.set(false);
    try {
      const created = await this.leaguesStore.createLeague(league);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
      void this.analyticsService.trackLeagueCreated({ name: created.name });
      this.selectedLeague.set(created.name);
      this.leagueChanged.emit(created.name);
    } catch (error) {
      console.error('Error adding league:', error);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveError, 'bug', true);
    }
  }

  onFormCancelled(): void {
    this.isFormOpen.set(false);
  }

  cancel(): void {
    this.leaguesToDelete = [];
    this.isModalOpen.set(false);
  }

  async editLeague(): Promise<void> {
    try {
      await this.appFacade.editLeague(this.newLeague(), this.leagueToChange());
      this.newLeague.set('');
      this.leagueToChange.set('');
      this.toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
      this.isModalOpen.set(false);
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
      this.isModalOpen.set(false);
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
        inputs: this.leaguesStore.leagueNames().map((league) => ({
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
}
