import { Component, computed, inject, input, model, OnInit, output, signal } from '@angular/core';
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
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkOutline, createOutline, trashOutline, trophyOutline } from 'ionicons/icons';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
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
    IonSearchbar,
    IonText,
    IonTitle,
    IonToolbar,
    SearchBlurDirective,
  ],
})
export class LeagueSelectorComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  isAddPage = input<boolean>(false);
  icon = input<string>('');
  leagues = input<string[]>([]);
  selectedLeague = model<string>('');

  leagueChanged = output<string>();
  availableLeagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagues();
    // The settings variant manages the league list, so it must show every league, including hidden ones.
    if (!this.isAddPage()) return this.sortByRecency(savedLeagues);
    this.hiddenLeagueSelectionService.selectionState();
    const savedJson = localStorage.getItem('leagueSelection');
    const savedSelection: Record<string, boolean> = savedJson ? JSON.parse(savedJson) : {};
    const visibleLeagues = savedLeagues.filter((league) => savedSelection[league] !== false);
    return this.sortByRecency([...new Set([...visibleLeagues, ...this.leagues()])]);
  });
  searchTerm = signal('');

  filteredLeagues = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const leagues = this.availableLeagues();
    return term ? leagues.filter((league) => league.toLowerCase().includes(term)) : leagues;
  });

  creatableName = computed(() => {
    const name = this.searchTerm().trim();
    if (!name) return '';
    const exists = this.leaguesStore.leagues().some((league) => league.toLowerCase() === name.toLowerCase());
    return exists ? '' : name;
  });

  isPickerOpen = signal(false);

  private recentLeagues = signal<string[]>(this.readRecentLeagues());

  presentingElement!: HTMLElement | null;

  constructor(
    public leaguesStore: LeaguesStore,
    private appFacade: AppFacade,
    private toastService: ToastService,
    private alertController: AlertController,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
  ) {
    addIcons({ trophyOutline, addOutline, checkmarkOutline, createOutline, trashOutline });
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page');
  }

  openPicker(): void {
    // Other selector instances (e.g. game-list rows) may have updated the recency since this one was created.
    this.recentLeagues.set(this.readRecentLeagues());
    this.searchTerm.set('');
    this.isPickerOpen.set(true);
  }

  closePicker(): void {
    this.isPickerOpen.set(false);
  }

  onSearchInput(event: CustomEvent): void {
    this.searchTerm.set(event.detail.value ?? '');
  }

  onLeagueTap(league: string): void {
    if (this.isAddPage()) {
      this.selectLeague(league);
    } else {
      void this.openEditAlert(league);
    }
  }

  async createLeague(): Promise<void> {
    const name = this.creatableName();
    if (!name) return;
    try {
      await this.leaguesStore.addLeague(name);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
      void this.analyticsService.trackLeagueCreated({ name });
      if (this.isAddPage()) {
        this.selectLeague(name);
      } else {
        this.searchTerm.set('');
      }
    } catch (error) {
      console.error('Error adding league:', error);
      this.toastService.showToast(TOAST_MESSAGES.leagueSaveError, 'bug', true);
    }
  }

  async openEditAlert(league: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Edit League',
      message: 'Enter the new league name',
      inputs: [{ name: 'league', type: 'text', value: league, placeholder: 'League name', cssClass: 'league-alert-input' }],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Save',
          handler: async (data: { league: string }) => {
            const newName = data.league?.trim();
            if (!newName || newName === league) return;
            try {
              await this.appFacade.editLeague(newName, league);
              this.toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
              if (league === this.selectedLeague()) {
                this.applySelection(newName);
              }
            } catch (error) {
              console.error('Error editing league:', error);
              this.toastService.showToast(TOAST_MESSAGES.leagueEditError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async openDeleteAlert(league: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: `Are you sure you want to delete "${league}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.leaguesStore.deleteLeague(league);
              this.toastService.showToast(TOAST_MESSAGES.leagueDeleteSuccess, 'remove-outline');
              if (league === this.selectedLeague()) {
                this.applySelection('');
              }
            } catch (error) {
              console.error('Error deleting league:', error);
              this.toastService.showToast(TOAST_MESSAGES.leagueDeleteError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private selectLeague(league: string): void {
    this.isPickerOpen.set(false);
    this.applySelection(league);
  }

  private applySelection(league: string): void {
    this.touchRecency(league);
    if (league !== this.selectedLeague()) {
      this.selectedLeague.set(league);
      this.leagueChanged.emit(league);
    }
  }

  private sortByRecency(leagues: string[]): string[] {
    const rank = new Map(this.recentLeagues().map((league, index) => [league, index]));
    return [...leagues].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
  }

  private touchRecency(league: string): void {
    if (!league) return;
    const updated = [league, ...this.recentLeagues().filter((recent) => recent !== league)].slice(0, 10);
    this.recentLeagues.set(updated);
    localStorage.setItem('leagueRecency', JSON.stringify(updated));
  }

  private readRecentLeagues(): string[] {
    const savedJson = localStorage.getItem('leagueRecency');
    return savedJson ? JSON.parse(savedJson) : [];
  }
}
