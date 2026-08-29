import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  OnInit,
  QueryList,
  Signal,
  ViewChild,
  ViewChildren,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { InputCustomEvent } from '@ionic/angular';
import {
  IonAccordion,
  IonAccordionGroup,
  IonCheckbox,
  IonCol,
  IonGrid,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronExpandOutline } from 'ionicons/icons';
import { PINS } from 'src/app/core/constants/app.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { KeyboardToolbarService } from 'src/app/core/services/keyboard-toolbar/keyboard-toolbar.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { countPatternUsage, rankByUsage } from 'src/app/core/utils/game-utils/usage.utils';
import { createEmptyGame, getThrowValue } from 'src/app/core/utils/game-utils/frame.utils';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { LeagueSelectorComponent } from '../league-selector/league-selector.component';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { PinInputComponent, ThrowConfirmedEvent } from '../pin-input/pin-input.component';
import { formatThrowDisplay } from 'src/app/core/utils/game-utils/score-input.utils';

interface ThrowCellView {
  value: number | undefined;
  display: string;
  isSplit: boolean;
  pinsStanding: number[];
  showPinDeck: boolean;
  disabled: boolean;
}

interface FrameView {
  frameIndex: number;
  frameNumber: number;
  isTenth: boolean;
  throws: ThrowCellView[];
  score: number | undefined;
  showScore: boolean;
  showZeroPlaceholder: boolean;
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  providers: [KeyboardToolbarService],
  imports: [
    IonList,
    IonCheckbox,
    IonItem,
    IonTextarea,
    IonGrid,
    IonRow,
    IonCol,
    IonInput,
    FormsModule,
    LeagueSelectorComponent,
    IonModal,
    GenericTypeaheadComponent,
    IonLabel,
    BallSelectComponent,
    PinInputComponent,
    PinDeckComponent,
    IonAccordion,
    IonAccordionGroup,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GameComponent implements OnInit {
  // --- Inputs ---
  ballSelectorId = input<string>();
  showMetadata = input<boolean>(true);
  patternModalId = input.required<string>();
  game = input.required<Game>();
  maxScore = input<number | undefined>(undefined);
  strikeDisabled = input<boolean>(true);
  spareDisabled = input<boolean>(true);
  isPinInputMode = input<boolean>(false);

  hidePinInput = input<boolean>(false);
  highlightCurrentThrow = input<boolean>(true);

  // Pin Input Mode
  pinsLeftStanding = input<number[]>(PINS);
  currentFrameIndex = input<number>(0);
  currentThrowIndex = input<number>(0);
  canStrike = input<boolean>(false);
  canSpare = input<boolean>(false);
  canUndo = input<boolean>(false);
  isGameComplete = input<boolean>(false);

  // --- Outputs ---
  throwInput = output<{ frameIndex: number; throwIndex: number; value: string }>();
  leagueChanged = output<string>();
  isPracticeChanged = output<boolean>();
  patternChanged = output<string[]>();
  noteChanged = output<string>();
  ballsChanged = output<string[]>();
  toolbarStateChanged = output<{ show: boolean; offset: number }>();
  inputFocused = output<{ frameIndex: number; throwIndex: number }>();

  // Pin Input Mode - Events from Child to Parent
  pinThrowConfirmed = output<ThrowConfirmedEvent>();
  pinUndoRequested = output<void>();
  seriesStatsClick = output<void>();
  showStatsButton = input<boolean>(false);
  statsEnabled = input<boolean>(true);
  // Pin mode edit - score cell clicked
  scoreCellClick = output<{ frameIndex: number; throwIndex: number }>();

  // --- View Children ---
  @ViewChildren(IonInput) inputs!: QueryList<IonInput>;
  @ViewChild('leagueSelector') leagueSelector!: LeagueSelectorComponent;
  @ViewChild('checkbox') checkbox!: IonCheckbox;

  // --- Computed State ---
  currentGame: Signal<Game> = computed(() => this.game() || createEmptyGame());

  frameVms: Signal<FrameView[]> = computed(() => {
    const frames = this.game()?.frames ?? [];
    const frameScores = this.game()?.frameScores ?? [];

    return Array.from({ length: 10 }, (_, frameIndex): FrameView => {
      const frame = frames[frameIndex];
      const isTenth = frameIndex === 9;
      const first = getThrowValue(frame, 0);
      const second = getThrowValue(frame, 1);

      const throws = Array.from({ length: isTenth ? 3 : 2 }, (_, throwIndex): ThrowCellView => {
        const value = getThrowValue(frame, throwIndex);
        return {
          value,
          display: formatThrowDisplay(frame, throwIndex, isTenth),
          isSplit: frame?.throws?.[throwIndex]?.isSplit ?? false,
          pinsStanding: frame?.throws?.[throwIndex]?.pinsLeftStanding ?? [],
          showPinDeck: value !== undefined && (throwIndex !== 1 || isTenth || first !== 10),
          disabled: (throwIndex === 1 && !isTenth && first === 10) || (throwIndex === 2 && first !== 10 && (first ?? 0) + (second ?? 0) !== 10),
        };
      });

      const score = frameScores[frameIndex];
      const hasScore = Number.isFinite(score);
      const hasThrow = first !== undefined || second !== undefined;

      return {
        frameIndex,
        frameNumber: frameIndex + 1,
        isTenth,
        throws,
        score,
        showScore: hasThrow && hasScore,
        showZeroPlaceholder: !(hasThrow && hasScore) && !(isTenth && first === undefined),
      };
    });
  });

  ballsText = computed(() => (this.currentGame().balls ?? []).join(', '));
  patternsText = computed(() => (this.currentGame().patterns ?? []).join(', '));

  /** Patterns sorted by how often they were played, most used first. */
  rankedPatterns = computed(() => {
    const usage = countPatternUsage(this.gamesStore.games());
    return rankByUsage(this.patternsStore.allPatterns(), usage, (pattern) => pattern.title ?? '');
  });

  // --- Local UI State ---
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;
  presentingElement!: HTMLElement | null;
  patternTypeaheadConfig: TypeaheadConfig<Partial<Pattern>> = this.typeaheadConfigService.partialPattern;
  ballTypeaheadConfig: TypeaheadConfig<Ball> = this.typeaheadConfigService.ball;

  private keyboardToolbar = inject(KeyboardToolbarService);
  readonly toolbarState = this.keyboardToolbar.state;
  private localFrameIndex = 0;
  private localThrowIndex = 0;

  constructor(
    public settingsStore: SettingsStore,
    public patternsStore: PatternsStore,
    public ballsStore: BallsStore,
    private gamesStore: GamesStore,
    private hapticService: HapticService,
    private patternService: PatternService,
    private toastService: ToastService,
    private typeaheadConfigService: TypeaheadConfigService,
  ) {
    addIcons({ chevronExpandOutline });
    effect(() => this.toolbarStateChanged.emit(this.toolbarState()));
  }

  async ngOnInit(): Promise<void> {
    this.presentingElement = document.querySelector('.ion-page')!;
  }

  // PIN INPUT MODE - PASS-THROUGH HANDLERS
  onPinThrowConfirmed(event: ThrowConfirmedEvent): void {
    this.pinThrowConfirmed.emit(event);
  }

  onPinUndoRequested(): void {
    this.pinUndoRequested.emit();
  }

  onScoreCellClicked(frameIndex: number, throwIndex: number): void {
    if (this.isPinInputMode()) {
      this.scoreCellClick.emit({ frameIndex, throwIndex });
    }
  }

  // STANDARD GRID MODE LOGIC

  handleInputFocus(frameIndex: number, throwIndex: number): void {
    this.localFrameIndex = frameIndex;
    this.localThrowIndex = throwIndex;
    this.keyboardToolbar.setFocused(true);
    this.inputFocused.emit({ frameIndex, throwIndex });
  }

  onScoreInput(event: InputCustomEvent, frameIndex: number, throwIndex: number): void {
    const inputValue = event.detail.value ?? '';
    this.throwInput.emit({ frameIndex, throwIndex, value: inputValue });
  }

  selectSpecialScore(char: string): void {
    if (this.localFrameIndex === null || this.localThrowIndex === null) {
      return;
    }
    this.throwInput.emit({
      frameIndex: this.localFrameIndex,
      throwIndex: this.localThrowIndex,
      value: char,
    });
  }

  async focusNextInput(frameIndex: number, inputIndex: number) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const inputArray = this.inputs.toArray();
    const currentInputPosition = frameIndex * 2 + inputIndex;

    for (let i = currentInputPosition + 1; i < inputArray.length; i++) {
      const nextInput = inputArray[i];
      const nextInputElement = await nextInput.getInputElement();

      if (!nextInputElement.disabled) {
        nextInput.setFocus();
        break;
      }
    }
  }

  handleInvalidInput(frameIndex: number, throwIndex: number): void {
    this.hapticService.vibrate(ImpactStyle.Heavy);
    const inputArray = this.inputs.toArray();
    const inputPosition = this.getInputPosition(frameIndex, throwIndex);

    if (inputPosition >= 0 && inputPosition < inputArray.length) {
      const input = inputArray[inputPosition];
      input.value = '';
    }
  }

  private getInputPosition(frameIndex: number, throwIndex: number): number {
    return frameIndex < 9 ? frameIndex * 2 + throwIndex : 18 + throwIndex;
  }

  getBallIds(names: string[] | undefined): string[] {
    if (!names) return [];

    return this.ballsStore
      .allBalls()
      .filter((ball) => names.includes(ball.ball_name))
      .map((ball) => ball.ball_id);
  }

  // --- Passthrough Event Emitters ---
  onBallAdd(ballIds: string[]) {
    const allBalls = this.ballsStore.allBalls();
    const selected = ballIds.map((id) => allBalls.find((b) => b.ball_id === id)).filter((b): b is Ball => !!b);
    this.ballsChanged.emit(selected.map((b) => b.ball_name));
    this.saveBallToArsenal(selected);
  }

  onLeagueChanged(league: string) {
    this.leagueChanged.emit(league);
  }
  onPatternChanged(patterns: string[]) {
    this.patternChanged.emit(patterns.length > 2 ? patterns.slice(-2) : patterns);
  }
  onBallSelect(selectedBalls: string[], modal: IonModal) {
    modal.dismiss();
    this.ballsChanged.emit(selectedBalls);
  }
  onNoteChange(note: string) {
    this.noteChanged.emit(note);
  }
  onIsPracticeChange(isPractice: boolean) {
    this.isPracticeChanged.emit(isPractice);
  }

  private async saveBallToArsenal(balls: Ball[]): Promise<void> {
    const failed = await this.ballsStore.saveBallsToArsenal(balls);
    const saved = balls.filter((b) => !failed.includes(b));

    if (saved.length) {
      this.toastService.showToast(`Balls added to arsenal: ${saved.map((b) => b.ball_name).join(', ')}`, 'checkmark-outline');
    }
    if (failed.length) {
      this.toastService.showToast(`Failed to add: ${failed.map((b) => b.ball_name).join(', ')}.`, 'bug', true);
    }
  }
}
