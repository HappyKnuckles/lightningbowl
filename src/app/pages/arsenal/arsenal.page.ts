import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { Component, ElementRef, Signal, ViewChild, computed, effect, model, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { AlertController, ItemReorderCustomEvent, ModalController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonReorder,
  IonReorderGroup,
  IonRippleEffect,
  IonSegment,
  IonSegmentButton,
  IonSegmentContent,
  IonSegmentView,
  IonSelect,
  IonSelectOption,
  IonText,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Chart } from 'chart.js';
import { addIcons } from 'ionicons';
import {
  add,
  arrowUndoOutline,
  chevronBack,
  chevronDownOutline,
  closeCircle,
  ellipsisVerticalOutline,
  handLeftOutline,
  openOutline,
  trashOutline,
} from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Ball, BallDrilling, BallLayout, LayoutSystem } from 'src/app/core/models/ball.model';
import { BowlerFit, BowlingStyle, GripStyle } from 'src/app/core/models/fit.model';
import {
  compact,
  formatInches,
  formatLayout,
  isCompleteLayout,
  isSameLayout,
  GRIP_STYLE_LABELS,
  LAYOUT_PRESETS,
  LAYOUT_SYSTEM_LABELS,
  parseDegrees,
  parseInches,
  parsePapVertical,
} from 'src/app/core/utils/drill-utils/drill.utils';
import { BowlerFitPipe, HoleSizesPipe, InchesPipe, LayoutPipe } from 'src/app/shared/pipes/drill-pipes/drill.pipes';
import { BallStats } from 'src/app/core/models/stats.model';
import { findBallInArsenal, getThrowBallKey } from 'src/app/core/utils/game-utils/ball.utils';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { BallStatsComponent } from 'src/app/shared/components/ball-stats/ball-stats.component';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { BallListComponent } from 'src/app/shared/components/ball-list/ball-list.component';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';

@Component({
  selector: 'app-arsenal',
  templateUrl: './arsenal.page.html',
  styleUrls: ['./arsenal.page.scss'],
  providers: [ModalController],
  imports: [
    BallImagePipe,
    BallStatsComponent,
    IonRippleEffect,
    IonListHeader,
    IonSegmentButton,
    IonSegment,
    IonReorder,
    IonReorderGroup,
    IonChip,
    IonItemOptions,
    IonItemOption,
    IonItemSliding,
    IonText,
    IonThumbnail,
    IonModal,
    IonIcon,
    IonButtons,
    IonButton,
    IonLabel,
    IonItem,
    IonList,
    IonImg,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    FormsModule,
    BallListComponent,
    GenericTypeaheadComponent,
    IonSegmentContent,
    IonSegmentView,
    IonCard,
    IonCardContent,
    IonSelect,
    IonSelectOption,
    IonInput,
    InchesPipe,
    LayoutPipe,
    HoleSizesPipe,
    BowlerFitPipe,
  ],
})
export class ArsenalPage implements OnInit {
  @ViewChild('core', { static: false }) coreModal!: IonModal;
  @ViewChild('coverstock', { static: false }) coverstockModal!: IonModal;
  coverstockBalls: Ball[] = [];
  coreBalls: Ball[] = [];
  presentingElement!: HTMLElement | null;

  ballTypeaheadConfig: TypeaheadConfig<Ball> = this.typeaheadConfigService.ball;
  ballsWithoutArsenal: Signal<Ball[]> = computed(() =>
    this.ballsStore
      .myBalls()
      .filter((ball) => !this.ballsStore.arsenal().some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight)),
  );
  selectedSegment = model('arsenal');

  /**
   * Per-ball stats for the balls currently in the arsenal, across all time.
   *
   * This deliberately differs from the stats page in both directions. It ignores the game
   * filter, because the question here is whether a ball has earned its place in the bag
   * rather than how it did in one league. And it covers only balls still owned, plus the
   * owned balls that have never been thrown, which is the most useful answer of all and
   * one the game history alone can never produce.
   */
  readonly ballStats = computed<BallStats[]>(() => {
    const arsenal = this.ballsStore.arsenal();
    const fromHistory = this.statsService.calculateBallStats(this.gamesStore.games());

    const owned = fromHistory.filter((stats) => findBallInArsenal({ name: stats.name, weight: stats.weight }, arsenal));
    const covered = new Set(owned.map((stats) => stats.key));

    const neverThrown = arsenal
      .filter((ball) => !covered.has(getThrowBallKey({ name: ball.ball_name, weight: ball.core_weight })))
      .map(
        (ball): BallStats => ({
          key: getThrowBallKey({ name: ball.ball_name, weight: ball.core_weight }),
          name: ball.ball_name,
          displayName: `${ball.ball_name} ${ball.core_weight}lbs`,
          weight: ball.core_weight,
          image: ball.ball_image || ball.thumbnail_image || '',
          tier: 'basic',
          gameCount: 0,
          detailedGameCount: 0,
          avg: 0,
          highestGame: 0,
          lowestGame: 0,
          cleanGameCount: 0,
          lastUsed: 0,
        }),
      );

    return [...owned, ...neverThrown];
  });
  @ViewChild('balls', { static: false }) ballChart?: ElementRef;
  private ballsChartInstance: Chart | null = null;
  readonly loadingWeightBallIds = signal<Set<string>>(new Set());
  readonly availableWeights = ['12', '13', '14', '15', '16'];
  readonly layoutSystems = Object.entries(LAYOUT_SYSTEM_LABELS) as [LayoutSystem, string][];
  readonly layoutPresets = LAYOUT_PRESETS;
  readonly customLayoutPresets = computed(() => this.settingsStore.layoutPresets());
  // the bowler's own layout before quick picks replaced it, so the open ball detail can offer an undo
  readonly layoutBeforePreset = signal<BallLayout | null>(null);
  // the open ball's layout per system, so switching systems back and forth doesn't lose the values
  private readonly layoutsBySystem = new Map<LayoutSystem, BallLayout>();
  readonly gripStyles = Object.entries(GRIP_STYLE_LABELS) as [GripStyle, string][];
  readonly detailSegment = signal<'ball' | 'drilling'>('ball');
  // key (ball_id + core_weight) of the ball whose detail modal is open
  readonly openBallKey = signal<string | null>(null);
  readonly isFitModalOpen = signal(false);
  readonly fitForm = signal<FitForm>(emptyFitForm());
  readonly fit = computed(() => this.settingsStore.fit());
  // two-handers don't use a thumb hole, so the ball drilling hides thumb fields
  readonly isTwoHanded = computed(() => this.settingsStore.fit()?.style === 'two-handed');

  constructor(
    public ballsStore: BallsStore,
    private hapticService: HapticService,
    private alertController: AlertController,
    private loadingService: LoadingService,
    public toastService: ToastService,
    public modalCtrl: ModalController,
    private ballService: BallService,
    private chartGenerationService: ChartGenerationService,
    private typeaheadConfigService: TypeaheadConfigService,
    private gamesStore: GamesStore,
    private statsService: GameStatsService,
    private settingsStore: SettingsStore,
  ) {
    addIcons({
      add,
      ellipsisVerticalOutline,
      trashOutline,
      chevronBack,
      openOutline,
      chevronDownOutline,
      handLeftOutline,
      closeCircle,
      arrowUndoOutline,
    });
    effect(() => {
      if (this.selectedSegment() === 'compare') {
        this.generateBallDistributionChart();
      }
    });
  }

  ngOnInit() {
    this.presentingElement = document.querySelector('.ion-page');
  }

  private generateBallDistributionChart(): void {
    try {
      if (!this.ballChart) {
        return;
      }
      this.ballsChartInstance = this.chartGenerationService.generateBallDistributionChart(
        this.ballChart!,
        this.ballsStore.arsenal(),
        this.ballsChartInstance!,
      );
    } catch (error) {
      console.error('Error generating ball distribution chart:', error);
      this.toastService.showToast(TOAST_MESSAGES.chartGenerationError, 'bug', true);
    }
  }

  async removeFromArsenal(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Heavy);
      const alert = await this.alertController.create({
        header: 'Confirm Deletion',
        message: `Are you sure you want to remove ${ball.ball_name} from your arsenal?`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            handler: async () => {
              try {
                await this.ballsStore.removeFromArsenal(ball);
                this.toastService.showToast(`Ball removed from arsenal: ${ball.ball_name}`, 'checkmark-outline');
              } catch (error) {
                console.error('Error removing ball from arsenal:', error);
                this.toastService.showToast(TOAST_MESSAGES.ballDeleteError, 'bug', true);
              }
            },
          },
        ],
      });

      await alert.present();
    } catch (error) {
      console.error('Error displaying removal alert:', error);
      this.toastService.showToast(TOAST_MESSAGES.unexpectedError, 'warning', true);
    }
  }

  async reorderArsenal(event: ItemReorderCustomEvent): Promise<void> {
    event.detail.complete();

    const arsenal = this.ballsStore.arsenal();
    const [movedItem] = arsenal.splice(event.detail.from, 1);
    arsenal.splice(event.detail.to, 0, movedItem);

    arsenal.forEach((ball, idx) => (ball.position = idx + 1));

    await Promise.all(arsenal.map((ball) => this.ballsStore.saveBallToArsenal(ball)));
  }

  async saveBallToArsenal(balls: Ball[]): Promise<void> {
    const failed = await this.ballsStore.saveBallsToArsenal(balls);
    const saved = balls.filter((b) => !failed.includes(b));

    if (saved.length) {
      this.toastService.showToast(`Balls added to arsenal: ${saved.map((b) => b.ball_name).join(', ')}`, 'checkmark-outline');
    }
    if (failed.length) {
      this.toastService.showToast(`Failed to add: ${failed.map((b) => b.ball_name).join(', ')}.`, 'bug', true);
    }
    if (saved.length) {
      await this.promptForDrilling(saved);
    }
  }

  openBallDetail(ball: Ball, segment: 'ball' | 'drilling' = 'ball'): void {
    this.detailSegment.set(segment);
    this.openBallKey.set(ball.ball_id + ball.core_weight);
  }

  // The segment's initial value doesn't move the segment view, so jump it to the selected tab once the modal is shown.
  async syncDetailSegmentView(event: Event): Promise<void> {
    const view = (event.target as HTMLElement).querySelector('ion-segment-view');
    const contentId = this.detailSegment() === 'drilling' ? 'ball-drilling' : 'ball-detail';
    await view?.setContent(contentId, false);
  }

  closeBallDetail(): void {
    this.openBallKey.set(null);
    this.layoutBeforePreset.set(null);
    this.layoutsBySystem.clear();
  }

  // Right after adding is when the bowler has the drill sheet at hand, so offer to fill it in.
  private async promptForDrilling(added: Ball[]): Promise<void> {
    const [first] = added;
    const others = added.length - 1;
    const alert = await this.alertController.create({
      header: 'Add drilling?',
      message:
        others > 0
          ? `Add the layout and hole sizes for ${first.ball_name} now? The other ${others === 1 ? 'ball' : `${others} balls`} can be filled in from their Drilling tab later.`
          : `Add the layout and hole sizes for ${first.ball_name} now? You can also do this later from the ball's Drilling tab.`,
      buttons: [
        { text: 'Later', role: 'cancel' },
        { text: 'Add Drilling', handler: () => this.openBallDetail(first, 'drilling') },
      ],
    });
    await alert.present();
  }

  onBallSelectionChange(selected: Ball[]): void {
    const inArsenal = (ball: Ball) => this.ballsStore.arsenal().some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight);
    this.saveBallToArsenal(selected.filter((ball) => !inArsenal(ball)));
  }

  async getSameCoreBalls(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      this.loadingService.setLoading(true);

      this.coreBalls = await this.ballService.getBallsByCore(ball);

      if (this.coreBalls.length > 0) {
        this.coreModal.present();
      } else {
        this.toastService.showToast(`No similar balls found for core: ${ball.core_name}.`, 'information-circle-outline');
      }
    } catch (error) {
      console.error('Error fetching core balls:', error);
      this.toastService.showToast(`Error fetching balls for core ${ball.core_name}`, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  async getSameCoverstockBalls(ball: Ball): Promise<void> {
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      this.loadingService.setLoading(true);

      this.coverstockBalls = await this.ballService.getBallsByCoverstock(ball);

      if (this.coverstockBalls.length > 0) {
        await this.coverstockModal.present();
      } else {
        this.toastService.showToast(`No similar balls found for coverstock: ${ball.coverstock_name}.`, 'information-circle-outline');
      }
    } catch (error) {
      console.error('Error fetching coverstock balls:', error);
      this.toastService.showToast(`Error fetching balls for coverstock ${ball.coverstock_name}`, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  async onWeightSelect(ball: Ball, weight: string, selectEl: IonSelect): Promise<void> {
    const selectedWeight = Number(weight);
    if (!Number.isFinite(selectedWeight) || selectedWeight === Number(ball.core_weight)) return;

    const key = ball.ball_id + ball.core_weight;
    this.loadingWeightBallIds.update((s) => new Set([...s, key]));

    try {
      const replacementBall = await this.ballService.getBallVariant(ball.ball_id, selectedWeight);

      if (!replacementBall) {
        selectEl.value = ball.core_weight;
        this.toastService.showToast('Selected weight is unavailable for this ball.', 'alert-circle-outline', true);
        return;
      }

      const alreadyInArsenal = this.ballsStore
        .arsenal()
        .some((b) => b.ball_id === ball.ball_id && b.core_weight === replacementBall.core_weight && b.core_weight !== ball.core_weight);
      if (alreadyInArsenal) {
        selectEl.value = ball.core_weight;
        this.toastService.showToast(`${ball.ball_name} at ${selectedWeight}lbs is already in your arsenal.`, 'information-circle-outline', true);
        return;
      }

      await this.ballsStore.updateArsenalBall(ball, replacementBall);
      this.toastService.showToast(`${ball.ball_name} updated to ${selectedWeight}lbs.`, 'checkmark-outline');
    } catch {
      selectEl.value = ball.core_weight;
      this.toastService.showToast(TOAST_MESSAGES.ballLoadError, 'alert-circle-outline', true);
    } finally {
      this.loadingWeightBallIds.update((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  async onLayoutSystemChange(ball: Ball, system: LayoutSystem | ''): Promise<void> {
    const current = ball.drilling?.layout;
    if ((current?.system ?? '') === system) {
      return;
    }
    if (current) {
      this.layoutsBySystem.set(current.system, current);
    }
    // pin to PAP means the same in both systems, so it carries over to a system without remembered values
    const layout: BallLayout | undefined = system ? (this.layoutsBySystem.get(system) ?? { system, pinToPap: current?.pinToPap }) : undefined;
    this.layoutBeforePreset.set(null);
    await this.saveDrilling(ball, { ...ball.drilling, layout });
  }

  async onLayoutPresetSelect(ball: Ball, preset: BallLayout): Promise<void> {
    const current = ball.drilling?.layout;
    if (current && formatLayout(current) && !this.layoutBeforePreset() && !isSameLayout(current, preset)) {
      this.layoutBeforePreset.set(current);
    }
    await this.saveDrilling(ball, { ...ball.drilling, layout: { ...preset } });
  }

  async undoLayoutPreset(ball: Ball): Promise<void> {
    const layout = this.layoutBeforePreset();
    if (!layout) {
      return;
    }
    this.layoutBeforePreset.set(null);
    await this.saveDrilling(ball, { ...ball.drilling, layout });
  }

  async saveLayoutPreset(layout: BallLayout): Promise<void> {
    if (!isCompleteLayout(layout)) {
      this.toastService.showToast(TOAST_MESSAGES.layoutPresetIncomplete, 'bug', true);
      return;
    }
    const custom = this.settingsStore.layoutPresets();
    if ([...LAYOUT_PRESETS, ...custom].some((preset) => isSameLayout(preset, layout))) {
      this.toastService.showToast(TOAST_MESSAGES.layoutPresetExists, 'bug', true);
      return;
    }
    try {
      await this.settingsStore.saveLayoutPresets([...custom, { ...layout }]);
      this.toastService.showToast(TOAST_MESSAGES.layoutPresetSaveSuccess, 'checkmark-outline');
    } catch (error) {
      console.error('Error saving layout preset:', error);
      this.toastService.showToast(TOAST_MESSAGES.layoutPresetSaveError, 'bug', true);
    }
  }

  async removeLayoutPreset(preset: BallLayout, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertController.create({
      header: 'Remove preset?',
      message: `Remove ${formatLayout(preset)} from your layout presets?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          handler: async () => {
            try {
              await this.settingsStore.saveLayoutPresets(this.settingsStore.layoutPresets().filter((p) => p !== preset));
              this.toastService.showToast(TOAST_MESSAGES.layoutPresetRemoveSuccess, 'checkmark-outline');
            } catch (error) {
              console.error('Error removing layout preset:', error);
              this.toastService.showToast(TOAST_MESSAGES.layoutPresetSaveError, 'bug', true);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async onLayoutValueChange(
    ball: Ball,
    field: 'drillingAngle' | 'valAngle' | 'pinToPap' | 'psaToPap' | 'pinBuffer',
    raw: string | number | null | undefined,
  ): Promise<void> {
    const layout = ball.drilling?.layout;
    if (!layout) {
      return;
    }
    const value = field === 'drillingAngle' || field === 'valAngle' ? parseDegrees(raw) : parseInches(raw);
    if (!this.isValidMeasurement(value)) {
      return;
    }
    // a typed change makes the layout the bowler's own again, so there's nothing left to undo
    this.layoutBeforePreset.set(null);
    await this.saveDrilling(ball, { ...ball.drilling, layout: { ...layout, [field]: value } as BallLayout });
  }

  async onHoleSizeChange(
    ball: Ball,
    field: 'thumbSize' | 'middleFingerSize' | 'ringFingerSize',
    raw: string | number | null | undefined,
  ): Promise<void> {
    const value = parseInches(raw);
    if (!this.isValidMeasurement(value)) {
      return;
    }
    await this.saveDrilling(ball, { ...ball.drilling, [field]: value });
  }

  async onInsertChange(ball: Ball, field: 'thumbInsert' | 'fingerInserts', raw: string | number | null | undefined): Promise<void> {
    const value = raw?.toString().trim() || undefined;
    await this.saveDrilling(ball, { ...ball.drilling, [field]: value });
  }

  private isValidMeasurement(value: number | undefined): boolean {
    if (value !== undefined && (Number.isNaN(value) || value < 0)) {
      this.toastService.showToast(TOAST_MESSAGES.invalidMeasurement, 'bug', true);
      return false;
    }
    return true;
  }

  private async saveDrilling(ball: Ball, drilling: BallDrilling): Promise<void> {
    const layout = drilling.layout ? (compact(drilling.layout) as BallLayout) : undefined;
    try {
      await this.ballsStore.updateBallDrilling(ball, compact({ ...drilling, layout }));
    } catch (error) {
      console.error('Error saving drilling:', error);
      this.toastService.showToast(TOAST_MESSAGES.drillingSaveError, 'bug', true);
    }
  }

  openFitModal(): void {
    const fit = this.settingsStore.fit();
    const vertical = fit?.papVertical;
    this.fitForm.set({
      style: fit?.style ?? 'one-handed',
      grip: fit?.grip ?? '',
      middleSpan: formatInches(fit?.middleSpan),
      ringSpan: formatInches(fit?.ringSpan),
      papOver: formatInches(fit?.papOver),
      papVertical: vertical === undefined ? '' : vertical === 0 ? '0' : `${formatInches(Math.abs(vertical))} ${vertical > 0 ? 'up' : 'down'}`,
    });
    this.isFitModalOpen.set(true);
  }

  closeFitModal(): void {
    this.isFitModalOpen.set(false);
  }

  updateFitForm(field: keyof FitForm, value: string | number | null | undefined): void {
    this.fitForm.update((form) => ({ ...form, [field]: value?.toString() ?? '' }));
  }

  async saveFit(): Promise<void> {
    const form = this.fitForm();
    const twoHanded = form.style === 'two-handed';
    // grip and span are hidden for two-handers, so leftover values there are dropped rather than validated
    const measurements = {
      middleSpan: twoHanded ? undefined : parseInches(form.middleSpan),
      ringSpan: twoHanded ? undefined : parseInches(form.ringSpan),
      papOver: parseInches(form.papOver),
      papVertical: parsePapVertical(form.papVertical),
    };
    const invalid = Object.entries(measurements).some(
      ([field, value]) => value !== undefined && (Number.isNaN(value) || (field !== 'papVertical' && value < 0)),
    );
    if (invalid) {
      this.toastService.showToast(TOAST_MESSAGES.invalidMeasurement, 'bug', true);
      return;
    }

    try {
      const fit: BowlerFit = twoHanded ? { style: 'two-handed', ...measurements } : { grip: form.grip || undefined, ...measurements };
      await this.settingsStore.saveFit(compact<BowlerFit>(fit));
      this.toastService.showToast(TOAST_MESSAGES.fitSaveSuccess, 'checkmark-outline');
      this.closeFitModal();
    } catch (error) {
      console.error('Error saving fit:', error);
      this.toastService.showToast(TOAST_MESSAGES.fitSaveError, 'bug', true);
    }
  }
}

/** Raw text of the fit form; measurements are parsed on save so fractions like "4 1/8" can be typed freely. */
interface FitForm {
  style: BowlingStyle;
  grip: GripStyle | '';
  middleSpan: string;
  ringSpan: string;
  papOver: string;
  papVertical: string;
}

function emptyFitForm(): FitForm {
  return { style: 'one-handed', grip: '', middleSpan: '', ringSpan: '', papOver: '', papVertical: '' };
}
