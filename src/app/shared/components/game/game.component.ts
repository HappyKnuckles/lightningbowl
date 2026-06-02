import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, QueryList, ViewChild, ViewChildren, computed, inject, input, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, InfiniteScrollCustomEvent, ModalController } from '@ionic/angular';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonCol,
  IonGrid,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonItemDivider,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bowlingBallOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  createOutline,
  documentTextOutline,
  filterOutline,
  gridOutline,
  layersOutline,
  medalOutline,
  shareOutline,
  trashOutline,
} from 'ionicons/icons';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Game } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { GameEditService } from 'src/app/core/services/game-edit/game-edit.service';
import { GameShareService } from 'src/app/core/services/game-share/game-share.service';
import { BowlingGameValidationService } from 'src/app/core/services/game-utils/bowling-game-validation.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';

import { AccordionDelayedCloseDirective } from 'src/app/core/directives/accordion-delayed-close/accordion-delayed-close.directive';
import { LongPressDirective } from 'src/app/core/directives/long-press/long-press.directive';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { GameGridComponent } from '../game-grid/game-grid.component';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from '../generic-typeahead/typeahead-config.interface';
import { createPartialPatternTypeaheadConfig } from '../generic-typeahead/typeahead-configs';
import { PinDeckFrameRowComponent } from '../pin-deck-frame-row/pin-deck-frame-row.component';

interface MonthHeader {
  name: string;
  count: number;
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  providers: [DatePipe, ModalController, GameEditService],
  imports: [
    IonModal,
    IonBadge,
    IonLabel,
    IonItemDivider,
    IonList,
    IonText,
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonInput,
    IonCol,
    IonRow,
    IonGrid,
    IonTextarea,
    IonAccordion,
    IonItem,
    IonAccordionGroup,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    NgIf,
    NgFor,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    LongPressDirective,
    AccordionDelayedCloseDirective,
    GameGridComponent,
    GenericTypeaheadComponent,
    BallSelectComponent,
    PinDeckFrameRowComponent,
  ],
})
export class GameComponent implements OnInit {
  // DOM
  @ViewChild('modal', { static: false }) modal!: IonModal;
  @ViewChild('accordionGroup') accordionGroup!: IonAccordionGroup;
  @ViewChild(AccordionDelayedCloseDirective) delayedClose!: AccordionDelayedCloseDirective;
  @ViewChildren(GameGridComponent) gameGrids!: QueryList<GameGridComponent>;

  // Inputs
  games = input.required<Game[]>();
  isLeaguePage = input<boolean>(false);
  gameCount = input<number | undefined>(undefined);

  // Services
  public editService = inject(GameEditService);
  public gamesStore = inject(GamesStore);
  public ballsStore = inject(BallsStore);
  public settingsStore = inject(SettingsStore);
  public patternsStore = inject(PatternsStore);

  private alertController = inject(AlertController);
  private toastService = inject(ToastService);
  private leaguesStore = inject(LeaguesStore);
  private hapticService = inject(HapticService);
  private utilsService = inject(UtilsService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private patternService = inject(PatternService);
  private validationService = inject(BowlingGameValidationService);
  private shareService = inject(GameShareService);

  // Computed
  leagues = computed(() => {
    const savedLeagues = this.leaguesStore.leagues();
    if (!this.games) return savedLeagues;
    const leagueKeys = this.games().reduce((acc: string[], game: Game) => {
      if (game.league && !acc.includes(game.league)) acc.push(game.league);
      return acc;
    }, []);
    return [...new Set([...leagueKeys, ...savedLeagues])];
  });

  sortedGames = computed(() => [...this.games()].sort((a, b) => b.date - a.date));

  showingGames = computed(() => {
    return this.sortedGames().slice(0, this.loadedCount());
  });

  gameNumberMap = computed(() => {
    const allGames = this.sortedGames();
    const total = allGames.length;
    const map = new Map<string, number>();
    allGames.forEach((game, idx) => map.set(game.gameId, total - idx));
    return map;
  });

  monthHeaders = computed(() => {
    const games = this.showingGames();
    const headers = new Map<number, MonthHeader>();

    if (games.length === 0) return headers;

    const getMonthKey = (timestamp: number) => {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const formatName = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    };

    const counts = new Map<string, number>();
    for (const game of games) {
      const key = getMonthKey(game.date);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const firstKey = getMonthKey(games[0].date);
    headers.set(0, {
      name: formatName(games[0].date),
      count: counts.get(firstKey) || 0,
    });

    for (let i = 1; i < games.length; i++) {
      const currentKey = getMonthKey(games[i].date);
      const prevKey = getMonthKey(games[i - 1].date);

      if (currentKey !== prevKey) {
        headers.set(i, {
          name: formatName(games[i].date),
          count: counts.get(currentKey) || 0,
        });
      }
    }

    return headers;
  });
  // Pagination state
  private batchSize = 100;
  public loadedCount = signal(this.batchSize);
  public presentingElement?: HTMLElement;

  // Config
  patternTypeaheadConfig!: TypeaheadConfig<Partial<Pattern>>;
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  constructor() {
    addIcons({
      trashOutline,
      createOutline,
      shareOutline,
      bowlingBallOutline,
      gridOutline,
      documentTextOutline,
      medalOutline,
      cloudUploadOutline,
      cloudDownloadOutline,
      filterOutline,
      layersOutline,
    });
  }

  ngOnInit(): void {
    this.presentingElement = document.querySelector('.ion-page')!;
    this.patternTypeaheadConfig = createPartialPatternTypeaheadConfig((q) => this.patternService.searchPattern(q));
  }

  // PAGINATION
  loadMoreGames(event: InfiniteScrollCustomEvent): void {
    setTimeout(() => {
      this.loadedCount.update((count) => count + this.batchSize);
      event.target.complete();
      if (this.loadedCount() >= this.showingGames().length) {
        event.target.disabled = true;
      }
    }, 50);
  }

  // ACCORDION
  openExpansionPanel(accordionId?: string): void {
    const el = this.accordionGroup;
    el.value = el.value === accordionId ? undefined : accordionId;
  }

  // NAVIGATION
  navigateToBallsPage(balls: string[]): void {
    const searchQuery = balls.join(', ');
    if (this.isLeaguePage()) this.modalCtrl.dismiss();
    this.router.navigate(['tabs/balls'], { queryParams: { search: searchQuery } });
  }

  // DELETE
  async deleteGame(gameId: string): Promise<void> {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Are you sure you want to delete this game?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.gamesStore.deleteGame(gameId);
              this.toastService.showToast(TOAST_MESSAGES.gameDeleteSuccess, 'remove-outline');
            } catch (error) {
              console.error('Error deleting game:', error);
              this.toastService.showToast(TOAST_MESSAGES.gameDeleteError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // SHARE
  async takeScreenshotAndShare(game: Game): Promise<void> {
    this.delayedClose.markVisible(game.gameId);

    const accordion = document.getElementById(game.gameId);
    if (!accordion) {
      console.error('Accordion not found');
      return;
    }

    await new Promise((r) => setTimeout(r, 30));

    const scoreTemplate = accordion.querySelector('.grid-container') as HTMLElement;
    if (!scoreTemplate) {
      console.error('Score template not found');
      return;
    }

    const previousValue = this.accordionGroup.value;
    const accordionIsOpen = this.accordionGroup.value?.includes(game.gameId) ?? false;
    if (!accordionIsOpen) this.openExpansionPanel(game.gameId);

    const childNode = accordion.childNodes[1] as HTMLElement;

    try {
      await this.shareService.shareGame(game, scoreTemplate, childNode);
    } finally {
      this.accordionGroup.value = previousValue;
      this.delayedClose.clear(game.gameId);
    }
  }

  // EDIT
  saveOriginalStateAndEnableEdit(game: Game): void {
    if (!this.editService.isEditMode(game.gameId)) {
      this.editService.startEdit(game);
      this.openExpansionPanel(game.gameId);
      this.delayedClose.markVisible(game.gameId);
    } else {
      this.cancelEdit(game);
    }
  }

  cancelEdit(game: Game): void {
    this.editService.cancelEdit(game);
    const wasOpen = this.delayedClose.isVisible(game.gameId);
    this.openExpansionPanel(wasOpen ? game.gameId : undefined);
    this.delayedClose.clear(game.gameId);
  }

  async saveEdit(game: Game): Promise<void> {
    const success = await this.editService.saveEdit(game);
    if (!success) return;

    const wasOpen = this.delayedClose.isVisible(game.gameId);
    this.openExpansionPanel(wasOpen ? game.gameId : undefined);
    this.delayedClose.clear(game.gameId);
  }

  // EDIT INPUT
  onEditThrowInput(event: { frameIndex: number; throwIndex: number; value: string }, game: Game): void {
    const result = this.editService.handleThrowInput(event, game);

    if (result === 'invalid') {
      const grid = this.gameGrids.find((g) => g.game()?.gameId === game.gameId);
      grid?.handleInvalidInput(event.frameIndex, event.throwIndex);
      return;
    }

    if (result === 'recorded') {
      const grid = this.gameGrids.find((g) => g.game()?.gameId === game.gameId);
      grid?.focusNextInput(event.frameIndex, event.throwIndex);
    }
  }

  // PIN MODE
  onScoreCellClick(game: Game, frameIndex: number, throwIndex: number): void {
    this.editService.selectCell(game, frameIndex, throwIndex);
  }

  onPinThrowConfirmed(event: { pinsKnockedDown: number[] }, game: Game): void {
    this.editService.confirmPinThrow(event.pinsKnockedDown ?? [], game);
  }

  handlePinUndoRequested(game: Game): void {
    this.editService.undoPinThrow(game);
  }

  getPinsLeftStandingForEditedGame(game: Game): number[] {
    return this.editService.getPinsLeftStanding(game);
  }

  canRecordStrike(game: Game): boolean {
    return this.editService.canRecordStrike(game);
  }

  canRecordSpare(game: Game): boolean {
    return this.editService.canRecordSpare(game);
  }

  canUndoForPinMode(game: Game): boolean {
    return this.editService.canUndoPinThrow(game);
  }

  // BALLS / SERIES
  onBallSelect(selectedBalls: string[], game: Game, modal: IonModal): void {
    modal.dismiss();
    game.balls = selectedBalls;
  }

  updateSeries(game: Game, league?: string, patterns?: string[]): void {
    this.editService.propagateSeriesFields(game, league, patterns);
  }

  // HELPERS
  isGameValid(game: Game): boolean {
    return this.validationService.isGameValid(game);
  }

  parseIntValue(value: unknown): number {
    return this.utilsService.parseIntValue(value) as number;
  }

  getSelectedBallsText(game: Game): string {
    const balls = game.balls || [];
    return balls.length > 0 ? balls.join(', ') : 'None';
  }
}
