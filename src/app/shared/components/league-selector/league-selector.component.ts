import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastMessages } from '@constants/toast-messages.constants';
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
import { AnalyticsService } from '@services/analytics/analytics.service';
import { HiddenLeagueSelectionService } from '@services/hidden-league/hidden-league.service';
import { ToastService } from '@services/toast/toast.service';
import { AppFacade } from '@stores/app.facade';
import { LeaguesStore } from '@stores/leagues.store';
import { addIcons } from 'ionicons';
import { addOutline, createOutline, medalOutline } from 'ionicons/icons';

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
    NgIf,
    NgFor,
    FormsModule,
    ReactiveFormsModule,
    IonSelectOption,
  ],
})
export class LeagueSelectorComponent {
  @Input() isAddPage = false;
  @Output() leagueChanged = new EventEmitter<string>();
  selectedLeague = '';
  newLeague = '';
  leaguesToDelete: string[] = [];
  leagueToChange = '';
  isModalOpen = false;
  leagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagues();
    this.hiddenLeagueSelectionService.selectionState();
    const savedJson = localStorage.getItem('leagueSelection');
    if (!savedJson) {
      return savedLeagues;
    }
    const savedSelection: Record<string, boolean> = savedJson ? JSON.parse(savedJson) : {};
    return savedLeagues.filter((league) => {
      return savedSelection[league] !== false;
    });
  });
  constructor(
    public leaguesStore: LeaguesStore,
    private appFacade: AppFacade,
    private toastService: ToastService,
    private alertController: AlertController,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
    private analyticsService: AnalyticsService,
  ) {
    // this.leagueSubscriptions.add(
    //   merge(this.storageService.newLeagueAdded, this.storageService.leagueDeleted, this.storageService.leagueChanged).subscribe(() => {
    //     this.getLeagues();
    //   })
    // );
    addIcons({ medalOutline, addOutline, createOutline });
  }

  async onLeagueChange(event: IonSelectCustomEvent<SelectChangeEventDetail>): Promise<void> {
    if (event.detail.value === 'new') {
      await this.openAddAlert();
    } else if (event.detail.value === 'edit') {
      this.isModalOpen = true;
    } else if (event.detail.value === 'delete') {
      await this.openDeleteAlert();
    }
  }

  async saveLeague(): Promise<void> {
    try {
      await this.leaguesStore.addLeague(this.newLeague);
      this.selectedLeague = this.newLeague;
      this.leagueChanged.emit(this.selectedLeague);
      this.newLeague = '';
      this.toastService.showToast(ToastMessages.leagueSaveSuccess, 'add');
      this.isModalOpen = false;
      this.analyticsService.trackLeagueCreated({ name: this.selectedLeague });
    } catch (error) {
      console.error(error);
      this.toastService.showToast(ToastMessages.leagueSaveError, 'bug', true);
    }
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
      this.toastService.showToast(ToastMessages.leagueEditSuccess, 'checkmark-outline');
      this.isModalOpen = false;
    } catch (error) {
      console.error(error);
      this.toastService.showToast(ToastMessages.leagueEditError, 'bug', true);
    }
  }

  private async deleteLeague(): Promise<void> {
    try {
      for (const league of this.leaguesToDelete) {
        await this.leaguesStore.deleteLeague(league);
      }
      this.toastService.showToast(ToastMessages.leagueDeleteSuccess, 'checkmark-outline');
      this.isModalOpen = false;
    } catch (error) {
      console.error(error);
      this.toastService.showToast(ToastMessages.leagueDeleteError, 'bug', true);
    }
  }

  private async openDeleteAlert(): Promise<void> {
    await this.alertController
      .create({
        header: 'Delete League',
        message: 'Select the leagues to delete',
        inputs: this.leaguesStore.leagues().map((league) => {
          return {
            name: league,
            type: 'checkbox',
            label: league,
            value: league,
          };
        }),
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
      .then((alert) => {
        alert.present();
      });
  }

  private async openAddAlert(): Promise<void> {
    await this.alertController
      .create({
        header: 'Add League',
        message: 'Enter the league name',
        inputs: [
          {
            name: 'league',
            type: 'text',
            placeholder: 'League name',
            cssClass: 'league-alert-input',
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              this.selectedLeague = '';
              this.leagueChanged.emit(this.selectedLeague);
            },
          },
          {
            text: 'Add',
            handler: async (data) => {
              this.newLeague = data.league;
              await this.saveLeague();
            },
          },
        ],
      })
      .then((alert) => {
        alert.present();
      });
  }
}
