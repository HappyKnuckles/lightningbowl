import { Component, OnInit, OnDestroy, QueryList, ViewChildren, ViewChild, CUSTOM_ELEMENTS_SCHEMA, input, output, computed } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { NgFor, NgIf } from '@angular/common';
import { IonGrid, IonModal, IonRow, IonCol, IonInput, IonItem, IonTextarea, IonCheckbox, IonList, IonLabel } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ImpactStyle } from '@capacitor/haptics';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { LeagueSelectorComponent } from '../league-selector/league-selector.component';
import { InputCustomEvent } from '@ionic/angular';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { Game, createEmptyGame, getThrowValue } from 'src/app/core/models/game.model';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { createPartialPatternTypeaheadConfig } from '../generic-typeahead/typeahead-configs';
import { TypeaheadConfig } from '../generic-typeahead/typeahead-config.interface';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { Pattern } from 'src/app/core/models/pattern.model';
import { Keyboard } from '@capacitor/keyboard';
import { addIcons } from 'ionicons';
import { chevronExpandOutline } from 'ionicons/icons';
import { BallSelectComponent } from '../ball-select/ball-select.component';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { PinInputComponent, ThrowConfirmedEvent } from '../pin-input/pin-input.component';
import { PinDeckFrameRowComponent } from '../pin-deck-frame-row/pin-deck-frame-row.component';

@Component({
  selector: 'app-game-grid',
  templateUrl: './game-grid.component.html',
  styleUrls: ['./game-grid.component.scss'],
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
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GameGridComponent implements OnInit, OnDestroy {
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
  pinsLeftStanding = input<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
  presentingElement?: HTMLElement;
  patternTypeaheadConfig!: TypeaheadConfig<Partial<Pattern>>;

  showButtonToolbar = false;
  keyboardOffset = 0;
  isLandScapeMode = false;

  private isFrameInputFocused = false;
  private focusTimer: ReturnType<typeof setTimeout> | undefined;
  private localFrameIndex = 0;
  private localThrowIndex = 0;
  private keyboardShowSubscription: Subscription | undefined;
  private keyboardHideSubscription: Subscription | undefined;
  private resizeSubscription: Subscription | undefined;

  get currentGame(): Game {
    return this.game() || createEmptyGame();
  }

  constructor(
    public storageService: StorageService,
    private hapticService: HapticService,
    public utilsService: UtilsService,
    private platform: Platform,
    private patternService: PatternService,
  ) {
    this.initializeKeyboardListeners();
    addIcons({ chevronExpandOutline });
  }

  async ngOnInit(): Promise<void> {
    this.presentingElement = document.querySelector('.ion-page')!;
    this.patternTypeaheadConfig = createPartialPatternTypeaheadConfig((searchTerm: string) => this.patternService.searchPattern(searchTerm));
  }

  ngOnDestroy() {
    if (this.keyboardShowSubscription) this.keyboardShowSubscription.unsubscribe();
    if (this.keyboardHideSubscription) this.keyboardHideSubscription.unsubscribe();
    if (this.resizeSubscription) this.resizeSubscription.unsubscribe();
    if (this.focusTimer) clearTimeout(this.focusTimer);
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onViewportResize);
    }
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
  initializeKeyboardListeners() {
    if (this.platform.is('mobile') && !this.platform.is('mobileweb')) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        this.keyboardOffset = Math.max(0, info.keyboardHeight || 0);
        if (this.isFrameInputFocused) {
          this.showButtonToolbar = true;
          this.toolbarStateChanged.emit({ show: true, offset: this.keyboardOffset });
        }
      });
      Keyboard.addListener('keyboardWillHide', () => {
        this.keyboardOffset = 0;
        this.showButtonToolbar = false;
        this.toolbarStateChanged.emit({ show: false, offset: this.keyboardOffset });
      });
    } else if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onViewportResize);
    }
    this.resizeSubscription = this.platform.resize.subscribe(() => {
      this.isLandScapeMode = this.platform.isLandscape();
    });
  }

  handleInputFocus(frameIndex: number, throwIndex: number): void {
    this.localFrameIndex = frameIndex;
    this.localThrowIndex = throwIndex;
    this.isFrameInputFocused = true;
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

  private onViewportResize = () => {
    if (!window.visualViewport) return;
    const viewportHeight = window.visualViewport.height;
    const fullHeight = window.innerHeight;
    const keyboardActualHeight = fullHeight - viewportHeight;

    if (keyboardActualHeight > 100) {
      this.keyboardOffset = this.isLandScapeMode ? Math.max(0, keyboardActualHeight - 72) : Math.max(0, keyboardActualHeight - 85);
      if (this.isFrameInputFocused) {
        this.showButtonToolbar = true;
        this.toolbarStateChanged.emit({ show: true, offset: this.keyboardOffset });
      }
    } else {
      this.keyboardOffset = 0;
      this.showButtonToolbar = false;
      this.toolbarStateChanged.emit({ show: false, offset: this.keyboardOffset });
    }
  };

  // --- Passthrough Event Emitters ---
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
    const balls = this.currentGame?.balls || [];
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
}
