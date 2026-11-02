import { ChangeDetectionStrategy, Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { League, LeagueType, Season } from 'src/app/core/models/league.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { normalizeHandicap } from 'src/app/core/utils/league-utils/handicap.utils';
import {
  defaultSeasonName,
  fromDateInput,
  isInRange,
  newSeasonId,
  nextSeasonDraft,
  parseNumber,
  seasonRanges,
  sortSeasons,
  toDateInput,
  withNewSeason,
} from 'src/app/core/utils/league-utils/league.utils';

type HandicapField = 'basis' | 'percentage' | 'max' | 'startingAverage';

/** A season as it is being edited: the start is the value of a date input. */
interface SeasonDraft {
  id: string;
  name: string;
  start: string;
}

/**
 * Creates or edits a league or tournament: name, type and, for leagues, its seasons. Opened with
 * `newSeason`, it starts with a new season added, ready to save. Saves itself and dismisses with
 * the saved league (role 'confirm'), or with role 'delete' when the league was deleted.
 */
@Component({
  selector: 'app-league-form',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  templateUrl: './league-form.component.html',
  styleUrl: './league-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueFormComponent implements OnInit {
  readonly #modalCtrl = inject(ModalController);
  readonly #alertCtrl = inject(AlertController);

  readonly #leaguesStore = inject(LeaguesStore);
  readonly #gamesStore = inject(GamesStore);
  readonly #appFacade = inject(AppFacade);
  readonly #toastService = inject(ToastService);
  readonly #analyticsService = inject(AnalyticsService);
  // plain inputs: ModalController hands componentProps over by assigning them
  @Input() league?: League;
  @Input() newSeason = false;

  readonly isEdit = computed(() => !!this.league);
  readonly #leagueGames = computed(() => {
    const name = this.league?.name;
    return name ? this.#gamesStore.games().filter((game) => game.league === name) : [];
  });
  /** Games each season would have with the seasons as entered, by season id. */
  readonly seasonGameCounts = computed(() => {
    const ranges = seasonRanges(this.#draftLeague());
    const games = this.#leagueGames();
    return Object.fromEntries(ranges.map((range) => [range.season.id, games.filter((game) => isInRange(game.date, range)).length])) as Record<
      string,
      number | undefined
    >;
  });
  readonly name = signal('');

  readonly type = signal<LeagueType>('league');
  /** Newest first, the way they are listed. */
  readonly seasons = signal<SeasonDraft[]>([]);

  readonly hasHandicap = signal(false);

  /** Handicap rule as typed. */
  readonly handicap = signal<Record<HandicapField, string>>({ basis: '220', percentage: '90', max: '', startingAverage: '' });
  readonly error = computed(() => {
    const name = this.name().trim();
    if (!name) return 'Enter a name.';
    const taken = this.#leaguesStore.leagues().some((other) => other !== this.league?.name && other.toLowerCase() === name.toLowerCase());
    if (taken) return 'An event with this name already exists.';
    if (this.type() === 'league') {
      const starts = this.seasons().map((season) => fromDateInput(season.start));
      if (starts.some((start) => start === undefined)) return 'Every season needs a start date.';
      if (new Set(starts).size !== starts.length) return "Two seasons can't start on the same day.";
    }
    if (this.hasHandicap()) {
      const { basis, percentage, max, startingAverage } = this.handicap();
      if (!(parseNumber(basis)! > 0)) return 'Enter the handicap basis, e.g. 220.';
      const percent = parseNumber(percentage);
      if (!(percent! > 0) || percent! > 100) return 'Enter the handicap percentage, 1 to 100.';
      if ([max, startingAverage].some((value) => value.trim() && !(parseNumber(value)! >= 0))) return 'Max and starting average must be numbers.';
    }
    return null;
  });
  readonly saving = signal(false);
  readonly finished = signal(false);
  readonly sanctioned = signal(false);
  readonly note = signal('');

  constructor() {
    addIcons({ addOutline, trashOutline });
  }

  ngOnInit(): void {
    const league = this.league;
    if (league) {
      this.name.set(league.name);
      this.type.set(league.type);
      this.seasons.set(this.#toDrafts(league.seasons));
      this.finished.set(!!league.finished);
      this.sanctioned.set(!!league.sanctioned);
      this.note.set(league.note ?? '');
      if (league.handicap) {
        const { basis, percentage, max, startingAverage } = league.handicap;
        this.hasHandicap.set(true);
        this.handicap.set({
          basis: `${basis}`,
          percentage: `${percentage}`,
          max: max === undefined ? '' : `${max}`,
          startingAverage: startingAverage === undefined ? '' : `${startingAverage}`,
        });
      }
    } else {
      // most leagues are tracked by season: start with one beginning today
      this.seasons.set(this.#toDrafts([{ id: newSeasonId(), ...nextSeasonDraft() }]));
    }
    if (this.newSeason) this.startNewSeason();
  }

  setName(event: CustomEvent): void {
    this.name.set(String(event.detail.value ?? ''));
  }

  setType(event: CustomEvent): void {
    this.type.set(event.detail.value === 'tournament' ? 'tournament' : 'league');
  }

  setToggle(field: 'finished' | 'sanctioned' | 'hasHandicap', event: CustomEvent): void {
    this[field].set(!!event.detail.checked);
  }

  setNote(event: CustomEvent): void {
    this.note.set(String(event.detail.value ?? ''));
  }

  setHandicap(field: HandicapField, event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    this.handicap.update((handicap) => ({ ...handicap, [field]: value }));
  }

  setSeason(id: string, field: 'name' | 'start', event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    this.seasons.update((seasons) => seasons.map((season) => (season.id === id ? { ...season, [field]: value } : season)));
  }

  /** Adds a season starting today. A league without seasons also gets one for the games already played. */
  startNewSeason(): void {
    const firstGame = this.#leagueGames().reduce<number | undefined>(
      (first, game) => (first === undefined ? game.date : Math.min(first, game.date)),
      undefined,
    );
    const updated = withNewSeason(this.#draftLeague(), nextSeasonDraft(), firstGame);
    this.seasons.set(this.#toDrafts(updated.seasons));
  }

  removeSeason(id: string): void {
    this.seasons.update((seasons) => seasons.filter((season) => season.id !== id));
  }

  cancel(): void {
    void this.#modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    if (this.error() || this.saving()) return;
    const previous = this.league;
    const league: League = { ...this.#draftLeague(), createdAt: previous?.createdAt || Date.now() };
    this.saving.set(true);
    try {
      if (previous) {
        await this.#appFacade.updateLeague(league, previous.name);
        this.#toastService.showToast(TOAST_MESSAGES.leagueEditSuccess, 'checkmark-outline');
      } else {
        await this.#leaguesStore.addLeague(league);
        this.#toastService.showToast(TOAST_MESSAGES.leagueSaveSuccess, 'add');
        void this.#analyticsService.trackLeagueCreated({ name: league.name });
      }
      await this.#modalCtrl.dismiss(league, 'confirm');
    } catch (error) {
      console.error('Error saving league:', error);
      this.#toastService.showToast(previous ? TOAST_MESSAGES.leagueEditError : TOAST_MESSAGES.leagueSaveError, 'bug', true);
    } finally {
      this.saving.set(false);
    }
  }

  async delete(): Promise<void> {
    const league = this.league;
    if (!league) return;
    const alert = await this.#alertCtrl.create({
      header: 'Delete event?',
      message: `"${league.name}" and its seasons are removed. Its games stay in your history.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.#leaguesStore.deleteLeague(league.name);
              this.#toastService.showToast(TOAST_MESSAGES.leagueDeleteSuccess, 'remove-outline');
              await this.#modalCtrl.dismiss(null, 'delete');
            } catch (error) {
              console.error('Error deleting league:', error);
              this.#toastService.showToast(TOAST_MESSAGES.leagueDeleteError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /** The league as entered; seasons only count for leagues, and unnamed ones are named after their start. */
  #draftLeague(): League {
    const seasons: Season[] =
      this.type() === 'tournament'
        ? []
        : this.seasons().flatMap((draft) => {
            const start = fromDateInput(draft.start);
            return start === undefined ? [] : [{ id: draft.id, name: draft.name.trim() || defaultSeasonName(start), start }];
          });
    const league: League = { name: this.name().trim(), type: this.type(), seasons: sortSeasons(seasons), createdAt: this.league?.createdAt ?? 0 };
    if (this.finished()) league.finished = true;
    if (this.sanctioned()) league.sanctioned = true;
    if (this.note().trim()) league.note = this.note().trim();
    if (this.hasHandicap()) {
      const { basis, percentage, max, startingAverage } = this.handicap();
      const rule = normalizeHandicap({
        basis: parseNumber(basis),
        percentage: parseNumber(percentage),
        max: parseNumber(max),
        startingAverage: parseNumber(startingAverage),
      });
      if (rule) league.handicap = rule;
    }
    return league;
  }

  #toDrafts(seasons: Season[]): SeasonDraft[] {
    return sortSeasons(seasons)
      .reverse()
      .map((season) => ({ id: season.id, name: season.name, start: toDateInput(season.start) }));
  }
}
