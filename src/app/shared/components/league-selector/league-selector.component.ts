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
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkOutline, createOutline, trashOutline, trophyOutline } from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { SearchBlurDirective } from 'src/app/core/directives/search-blur/search-blur.directive';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { HiddenLeagueSelectionService } from 'src/app/core/services/hidden-league/hidden-league.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { currentSeason } from 'src/app/core/utils/league-utils/league.utils';

import { LeagueFormComponent } from '../league-form/league-form.component';

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
  isAddPage = input<boolean>(false);
  selectedLeague = model<string>('');
  icon = input<string>('');
  leagues = input<string[]>([]);
  leagueChanged = output<string>();

  isPickerOpen = signal(false);
  searchTerm = signal('');
  presentingElement!: HTMLElement | null;

  private recentLeagues = signal<string[]>(this.readRecentLeagues());

  private analyticsService = inject(AnalyticsService);
  private modalController = inject(ModalController);

  /** Under each name: "Tournament", or the season games added now count toward. */
  readonly leagueDetails = computed(() => {
    const details: Record<string, string> = {};
    for (const league of this.leaguesStore.leagueList()) {
      const season = currentSeason(league);
      const kind = league.type === 'tournament' ? 'Tournament' : season ? `Season ${season.name}` : '';
      details[league.name] = league.finished ? [kind, 'Finished'].filter(Boolean).join(' · ') : kind;
    }
    return details;
  });

  constructor(
    public leaguesStore: LeaguesStore,
    private toastService: ToastService,
    private alertController: AlertController,
    private hiddenLeagueSelectionService: HiddenLeagueSelectionService,
  ) {
    addIcons({ trophyOutline, addOutline, checkmarkOutline, createOutline, trashOutline });
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page');
  }

  availableLeagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagues();
    // The settings variant manages the league list, so it must show every league, including hidden ones.
    if (!this.isAddPage()) return this.sortByRecency(savedLeagues);
    this.hiddenLeagueSelectionService.selectionState();
    const savedJson = localStorage.getItem('leagueSelection');
    const savedSelection: Record<string, boolean> = savedJson ? JSON.parse(savedJson) : {};
    // finished events take no new games, but one the game is already in stays pickable
    const isOpen = (league: string) => !this.leaguesStore.getLeague(league)?.finished || league === this.selectedLeague();
    const visibleLeagues = savedLeagues.filter((league) => savedSelection[league] !== false && isOpen(league));
    return this.sortByRecency([...new Set([...visibleLeagues, ...this.leagues()])]);
  });

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
      void this.openLeagueForm(league);
    }
  }

  /** Type, seasons, name: everything about a league, in the league form. */
  async openLeagueForm(name: string): Promise<void> {
    const league = this.leaguesStore.getLeague(name) ?? (await this.leaguesStore.addLeague(name));
    const modal = await this.modalController.create({ component: LeagueFormComponent, componentProps: { league } });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string }>();
    if (name !== this.selectedLeague()) return;
    if (role === 'confirm' && data && data.name !== name) this.applySelection(data.name);
    if (role === 'delete') this.applySelection('');
  }

  /** Opens the New Event form with the searched name, and picks the event once it's saved. */
  async createLeague(): Promise<void> {
    const name = this.creatableName();
    if (!name) return;
    const modal = await this.modalController.create({ component: LeagueFormComponent, componentProps: { suggestedName: name } });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string }>();
    if (role !== 'confirm' || !data) return;
    if (this.isAddPage()) {
      this.selectLeague(data.name);
    } else {
      this.searchTerm.set('');
    }
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
