import { Component, CUSTOM_ELEMENTS_SCHEMA, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  createDefaultHandicapConfig,
  createDefaultTournamentConfig,
  createEmptyFeeStructure,
  createLeague,
  createSeason,
  DAYS_OF_WEEK,
  DayOfWeek,
  FeeStructure,
  HandicapSystemType,
  League,
  LEAGUE_EVENT_TYPES,
  LeagueEventType,
  LeagueFormatFlags,
  SANCTIONING_BODIES,
  SCHEDULE_TYPES,
  SanctioningBody,
  ScheduleType,
  Season,
  TournamentConfig,
  createDefaultFormatFlags,
} from 'src/app/core/models/league';

/** The editable, flattened shape backing the form (bound via ngModel). */
interface LeagueFormModel {
  name: string;
  eventType: LeagueEventType;
  bowlingCenter: string;
  dayOfWeek: DayOfWeek | '';
  startTime: string;
  scheduleType: ScheduleType;
  /** Selected custom dates as ISO `YYYY-MM-DD` strings (for ion-datetime). */
  customDatesIso: string[];
  weeksScheduled: number;
  lanePattern: string;
  numberOfGamesPerNight: number;
  sanctioningBody: SanctioningBody;
  website: string;
  contactInformation: string;
  color: string;
  active: boolean;
  description: string;
  notes: string;
  formatFlags: LeagueFormatFlags;
  handicapSystem: HandicapSystemType;
  handicapPercentage: number;
  handicapBaseScore: number;
  fees: FeeStructure;
  // Tournament-only
  tournamentEntryFee: number;
  tournamentQualifyingBlocks: number;
  tournamentMatchPlayRounds: number;
  tournamentStepladderFinalists: number;
}

@Component({
  selector: 'app-league-form',
  templateUrl: './league-form.component.html',
  styleUrls: ['./league-form.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonTextarea,
    IonNote,
    IonDatetime,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LeagueFormComponent {
  /** Whether the modal is open. */
  isOpen = input<boolean>(false);
  /** The league to edit, or null to create a new one. */
  league = input<League | null>(null);

  saved = output<League>();
  cancelled = output<void>();

  readonly eventTypes = LEAGUE_EVENT_TYPES;
  readonly sanctioningBodies = SANCTIONING_BODIES;
  readonly days = DAYS_OF_WEEK;
  readonly scheduleTypes = SCHEDULE_TYPES;

  model: LeagueFormModel = this.emptyModel();

  constructor() {
    // Hydrate the form whenever it is (re)opened.
    effect(() => {
      if (this.isOpen()) {
        this.model = this.hydrate(this.league());
      }
    });
  }

  get isEdit(): boolean {
    return !!this.league();
  }

  get isTournament(): boolean {
    return this.model.eventType === 'Tournament';
  }

  cancel(): void {
    this.cancelled.emit();
  }

  save(): void {
    if (!this.model.name.trim()) {
      return;
    }
    this.saved.emit(this.build());
  }

  private emptyModel(): LeagueFormModel {
    const hc = createDefaultHandicapConfig();
    return {
      name: '',
      eventType: 'League',
      bowlingCenter: '',
      dayOfWeek: '',
      startTime: '',
      scheduleType: 'weekly',
      customDatesIso: [],
      weeksScheduled: 0,
      lanePattern: '',
      numberOfGamesPerNight: 3,
      sanctioningBody: 'None',
      website: '',
      contactInformation: '',
      color: '#3880ff',
      active: true,
      description: '',
      notes: '',
      formatFlags: createDefaultFormatFlags(),
      handicapSystem: hc.system,
      handicapPercentage: hc.percentage,
      handicapBaseScore: hc.baseScore,
      fees: createEmptyFeeStructure(),
      tournamentEntryFee: 0,
      tournamentQualifyingBlocks: 1,
      tournamentMatchPlayRounds: 0,
      tournamentStepladderFinalists: 0,
    };
  }

  private hydrate(league: League | null): LeagueFormModel {
    const model = this.emptyModel();
    if (!league) {
      return model;
    }
    const season = this.activeSeason(league);
    const tourney = league.tournament;
    return {
      ...model,
      name: league.name,
      eventType: league.eventType,
      bowlingCenter: league.bowlingCenter ?? '',
      dayOfWeek: league.dayOfWeek ?? '',
      startTime: league.startTime ?? '',
      scheduleType: league.scheduleType ?? 'weekly',
      customDatesIso: (league.customDates ?? []).map((ms) => this.epochToIsoDate(ms)),
      weeksScheduled: season?.weeksScheduled ?? 0,
      lanePattern: league.lanePattern ?? '',
      numberOfGamesPerNight: league.numberOfGamesPerNight,
      sanctioningBody: league.sanctioningBody,
      website: league.website ?? '',
      contactInformation: league.contactInformation ?? '',
      color: league.color ?? model.color,
      active: league.active,
      description: league.description ?? '',
      notes: league.notes ?? '',
      formatFlags: { ...league.formatFlags },
      handicapSystem: league.handicap.system,
      handicapPercentage: league.handicap.percentage,
      handicapBaseScore: league.handicap.baseScore,
      fees: season ? { ...season.fees } : createEmptyFeeStructure(),
      tournamentEntryFee: tourney?.entryFee ?? 0,
      tournamentQualifyingBlocks: tourney?.qualifyingBlocks ?? 1,
      tournamentMatchPlayRounds: tourney?.matchPlayRounds ?? 0,
      tournamentStepladderFinalists: tourney?.stepladderFinalists ?? 0,
    };
  }

  private activeSeason(league: League): Season | undefined {
    return league.seasons.find((s) => s.active) ?? league.seasons[league.seasons.length - 1];
  }

  /** Builds the persisted League from the form model (create or edit). */
  private build(): League {
    const m = this.model;
    const customDates = m.scheduleType === 'custom' ? m.customDatesIso.map((iso) => this.isoDateToEpoch(iso)).sort((a, b) => a - b) : undefined;
    const overrides: Partial<League> = {
      name: m.name.trim(),
      eventType: m.eventType,
      bowlingCenter: m.bowlingCenter.trim() || undefined,
      dayOfWeek: m.dayOfWeek || undefined,
      startTime: m.startTime || undefined,
      scheduleType: m.scheduleType,
      customDates,
      lanePattern: m.lanePattern.trim() || undefined,
      numberOfGamesPerNight: Number(m.numberOfGamesPerNight) || 1,
      sanctioningBody: m.sanctioningBody,
      website: m.website.trim() || undefined,
      contactInformation: m.contactInformation.trim() || undefined,
      color: m.color || undefined,
      active: m.active,
      description: m.description.trim() || undefined,
      notes: m.notes.trim() || undefined,
      formatFlags: { ...m.formatFlags },
      handicap: { system: m.handicapSystem, percentage: Number(m.handicapPercentage) || 0, baseScore: Number(m.handicapBaseScore) || 0 },
      tournament: m.eventType === 'Tournament' ? this.buildTournament() : undefined,
    };

    const existing = this.league();
    const base = existing ? { ...existing, ...overrides } : createLeague(overrides.name!, overrides);

    // For custom schedules default the season length to the number of dates picked.
    const weeksScheduled = Number(m.weeksScheduled) || (m.scheduleType === 'custom' ? (customDates?.length ?? 0) : 0);
    base.seasons = this.applySeasonEdits(existing?.seasons ?? [], this.normalizeFees(m.fees), weeksScheduled);
    return base;
  }

  private buildTournament(): TournamentConfig {
    const existing = this.league()?.tournament ?? createDefaultTournamentConfig();
    return {
      ...existing,
      entryFee: Number(this.model.tournamentEntryFee) || 0,
      qualifyingBlocks: Number(this.model.tournamentQualifyingBlocks) || 1,
      matchPlayRounds: Number(this.model.tournamentMatchPlayRounds) || 0,
      stepladderFinalists: Number(this.model.tournamentStepladderFinalists) || 0,
    };
  }

  /** Writes the edited fees & schedule length onto the active season, creating one if needed. */
  private applySeasonEdits(seasons: Season[], fees: FeeStructure, weeksScheduled: number): Season[] {
    if (!seasons.length) {
      return [createSeason(`sea_${Date.now()}`, 1, `${this.model.name.trim()} — Season 1`, { fees, weeksScheduled })];
    }
    const activeIndex = seasons.findIndex((s) => s.active);
    const targetIndex = activeIndex >= 0 ? activeIndex : seasons.length - 1;
    return seasons.map((s, i) => (i === targetIndex ? { ...s, fees, weeksScheduled } : s));
  }

  private epochToIsoDate(ms: number): string {
    const d = new Date(ms);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  private isoDateToEpoch(iso: string): number {
    const [year, month, day] = iso
      .split('T')[0]
      .split('-')
      .map((n) => parseInt(n, 10));
    return new Date(year, (month || 1) - 1, day || 1).getTime();
  }

  private normalizeFees(fees: FeeStructure): FeeStructure {
    return {
      lineage: Number(fees.lineage) || 0,
      prizeFund: Number(fees.prizeFund) || 0,
      secretary: Number(fees.secretary) || 0,
      sanction: Number(fees.sanction) || 0,
      sidePots: Number(fees.sidePots) || 0,
      brackets: Number(fees.brackets) || 0,
      mysteryScore: Number(fees.mysteryScore) || 0,
      highGamePot: Number(fees.highGamePot) || 0,
    };
  }
}
