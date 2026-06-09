import { NgFor, NgIf } from '@angular/common';
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
import { Ball } from 'src/app/core/models/ball.model';
import { Game, createEmptyGame, getThrowValue } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { LeagueSelectorComponent } from '../league-selector/league-selector.component';
import { PinDeckFrameRowComponent } from '../pin-deck-frame-row/pin-deck-frame-row.component';
import { PinInputComponent, ThrowConfirmedEvent } from '../pin-input/pin-input.component';
import { KeyboardToolbarService } from 'src/app/core/services/keyboard-toolbar/keyboard-toolbar.service';
import { createPartialPatternTypeaheadConfig } from 'src/app/core/configs/typeahead/pattern.config';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { PINS } from 'src/app/core/constants/app.constants';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  providers: [KeyboardToolbarService],
  imports: [
    NgFor,
    IonList,
    IonCheckbox,
    IonItem,
    IonTextarea,
    IonGrid,
    IonRow,
    IonCol,
    IonInput,
    FormsModule,
    NgIf,
    LeagueSelectorComponent,
    IonModal,
    GenericTypeaheadComponent,
    IonLabel,
    BallSelectComponent,
    PinInputComponent,
    PinDeckFrameRowComponent,
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
  frames = computed(() => this.game()?.frames ?? []);
  frameScores = computed(() => this.game()?.frameScores ?? []);

  // --- Local UI State ---
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;
  presentingElement!: HTMLElement | null;
  patternTypeaheadConfig: TypeaheadConfig<Partial<Pattern>> = this.typeaheadConfigService.partialPattern;
  ballTypeaheadConfig: TypeaheadConfig<Ball> = this.typeaheadConfigService.ball;

  showButtonToolbar = false;
  keyboardOffset = 0;
  isLandScapeMode = false;
  private keyboardToolbar = inject(KeyboardToolbarService);
  readonly toolbarState = this.keyboardToolbar.state;
  private localFrameIndex = 0;
  private localThrowIndex = 0;

  currentGame: Signal<Game> = computed(() => this.game() || createEmptyGame());

  constructor(
    public settingsStore: SettingsStore,
    public patternsStore: PatternsStore,
    public ballsStore: BallsStore,
    private hapticService: HapticService,
    public utilsService: UtilsService,
    private patternService: PatternService,
    private toastService: ToastService,
    private typeaheadConfigService: TypeaheadConfigService,
  ) {
    addIcons({ chevronExpandOutline });
    effect(() => this.toolbarStateChanged.emit(this.toolbarState()));
  }

  async ngOnInit(): Promise<void> {
    this.presentingElement = document.querySelector('.ion-page')!;
    this.patternTypeaheadConfig = createPartialPatternTypeaheadConfig((searchTerm: string) => this.patternService.searchPattern(searchTerm));
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
      this.showButtonToolbar = false;
      return;
    }
    this.throwInput.emit({
      frameIndex: this.localFrameIndex,
      throwIndex: this.localThrowIndex,
      value: char,
    });
  }

  // --- Helpers for Template ---
  isCellFocused(frameIndex: number, throwIndex: number): boolean {
    return this.currentFrameIndex() === frameIndex && this.currentThrowIndex() === throwIndex;
  }

  getLocalFrameValue(frameIndex: number, throwIndex: number): number | undefined {
    return getThrowValue(this.game().frames[frameIndex], throwIndex);
  }

  getFrameValue(frameIndex: number, throwIndex: number): string {
    const frame = this.game().frames[frameIndex];
    if (!frame) return '';

    const val = getThrowValue(frame, throwIndex);
    if (val === undefined || val === null) {
      return '';
    }

    const firstBall = getThrowValue(frame, 0);
    const isTenth = frameIndex === 9;

    if (throwIndex === 0) {
      return val === 10 ? 'X' : val.toString();
    }

    if (!isTenth) {
      if (firstBall !== undefined && firstBall !== 10 && firstBall + val === 10) {
        return '/';
      }
      return val.toString();
    }

    const secondBall = getThrowValue(frame, 1);

    if (throwIndex === 1) {
      if (firstBall !== undefined && firstBall !== 10 && firstBall + val === 10) {
        return '/';
      }
      return val === 10 ? 'X' : val.toString();
    }

    if (throwIndex === 2) {
      if (firstBall === 10) {
        if (secondBall === 10) {
          return val === 10 ? 'X' : val.toString();
        }
        return secondBall !== undefined && secondBall + val === 10 ? '/' : val.toString();
      }
      return val === 10 ? 'X' : val.toString();
    }

    return val.toString();
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

  // --- Template Getters ---
  getSelectedBallsText(): string {
    const balls = this.currentGame()?.balls || [];
    return balls.length > 0 ? balls.join(', ') : 'None';
  }

  isNumber(value: unknown): boolean {
    return this.utilsService.isNumber(value);
  }

  isThrowSplit(frameIndex: number, throwIndex: number): boolean {
    const frame = this.game()?.frames?.[frameIndex];
    if (!frame || !frame.throws || throwIndex >= frame.throws.length) {
      return false;
    }
    return frame.throws[throwIndex]?.isSplit ?? false;
  }

  trackByFrameIndex(index: number): number {
    return index;
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
