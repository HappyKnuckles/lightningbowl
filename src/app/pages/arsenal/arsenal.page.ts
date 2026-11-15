import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { Component, ElementRef, Signal, ViewChild, computed, effect, model, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImpactStyle } from '@capacitor/haptics';
import { ActionSheetButton, ActionSheetController, AlertController, ItemReorderCustomEvent, ModalController } from '@ionic/angular';
import {
  IonAccordion,
  IonAccordionGroup,
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
  IonTextarea,
  IonThumbnail,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Chart } from 'chart.js';
import { addIcons } from 'ionicons';
import {
  add,
  albumsOutline,
  archiveOutline,
  arrowUndoOutline,
  checkmarkOutline,
  createOutline,
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
import { getBallModelKey, getThrowBallKey, toThrowBall } from 'src/app/core/utils/game-utils/game-ball.utils';
import { arsenalBallLabel, isInArsenal, isRetired, twinLabel } from 'src/app/core/utils/ball-utils/arsenal-ball.utils';
import { ballKey } from 'src/app/core/utils/ball-utils/stored-ball.utils';
import { ArsenalPickerService } from 'src/app/core/services/arsenal-picker/arsenal-picker.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { ArsenalNameError, BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { BallStatsComponent } from 'src/app/shared/components/ball-stats/ball-stats.component';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { BallListComponent } from 'src/app/shared/components/ball-list/ball-list.component';
import { GenericTypeaheadComponent } from 'src/app/shared/components/generic-typeahead/generic-typeahead.component';
import { TypeaheadConfig } from 'src/app/core/models/typeahead-config.model';
import { TypeaheadConfigService } from 'src/app/core/services/typeahead-config/typeahead-config.service';
import { ballImageUrl } from 'src/app/core/utils/ball-utils/ball-image.utils';

type DetailSegment = 'ball' | 'drilling' | 'notes';

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
    IonTextarea,
    IonToggle,
    IonAccordion,
    IonAccordionGroup,
    DatePipe,
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
    this.ballsStore.myBalls().filter((ball) => !this.ballsStore.arsenal().some((b) => b.key === ball.key)),
  );
  /** The open arsenal's balls in use, as listed and charted. */
  readonly ballsInUse = computed(() => this.ballsStore.currentArsenalBalls().filter((ball) => !isRetired(ball)));
  /** The open arsenal's retired balls, last retired first. */
  readonly retiredBalls = computed(() =>
    this.ballsStore
      .currentArsenalBalls()
      .filter(isRetired)
      .sort((a, b) => (b.retiredAt ?? 0) - (a.retiredAt ?? 0)),
  );
  /**
   * What the list shows next to a ball's specs, by `arsenalId`: its nickname, or its number ("#2") for a
   * ball the arsenal has twice with nothing else to tell them apart (a twin's layout has its own chip).
   */
  readonly ballTags = computed<Record<string, string>>(() => {
    const arsenal = this.ballsStore.arsenal();
    const tags: Record<string, string> = {};
    for (const ball of arsenal) {
      const label = twinLabel(ball, arsenal);
      if (ball.arsenalId && (ball.nickname || label.startsWith('#'))) tags[ball.arsenalId] = label;
    }
    return tags;
  });
  selectedSegment = model('arsenal');

  /**
   * Per-ball stats for the balls currently in the open arsenal, across all time.
   *
   * This deliberately differs from the stats page in both directions. It ignores the game
   * filter, because the question here is whether a ball has earned its place in the bag
   * rather than how it did in one league. And it covers only balls still owned, plus the
   * owned balls that have never been thrown, which is the most useful answer of all and
   * one the game history alone can never produce.
   */
  readonly ballStats = computed<BallStats[]>(() => {
    const arsenal = this.ballsStore.arsenal();
    const shown = this.ballsStore.currentArsenalBalls();
    const fromHistory = this.statsService.calculateBallStats(this.gamesStore.games());

    // an arsenal ball's own games, and games that name an owned ball without saying which one
    const ownKeys = new Set(shown.flatMap((ball) => [getThrowBallKey(toThrowBall(ball)), getBallModelKey(toThrowBall(ball))]));
    const owned = fromHistory.filter((stats) => ownKeys.has(stats.key));
    const covered = new Set(owned.map((stats) => stats.key));

    const neverThrown = shown
      .filter((ball) => !covered.has(getThrowBallKey(toThrowBall(ball))))
      .map(
        (ball): BallStats => ({
          key: getThrowBallKey(toThrowBall(ball)),
          name: ball.ball_name,
          displayName: arsenalBallLabel(ball, arsenal),
          weight: ball.core_weight,
          image: ballImageUrl(ball, 'ball'),
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
  readonly detailSegment = signal<DetailSegment>('ball');
  // `arsenalId` of the ball whose detail modal is open
  readonly openBallId = signal<string | null>(null);
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
    private appFacade: AppFacade,
    private actionSheetController: ActionSheetController,
    private arsenalPicker: ArsenalPickerService,
  ) {
    addIcons({
      add,
      albumsOutline,
      archiveOutline,
      checkmarkOutline,
      createOutline,
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
        this.ballsInUse(),
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
        message:
          this.ballsStore.arsenals().length > 1
            ? `Are you sure you want to remove ${ball.ball_name} from all your arsenals?`
            : `Are you sure you want to remove ${ball.ball_name} from your arsenal?`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            handler: async () => {
              try {
                await this.appFacade.removeArsenalBall(ball);
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

    // the list shows the open arsenal's balls in use; all other balls keep their order after them
    const active = [...this.ballsInUse()];
    const [movedItem] = active.splice(event.detail.from, 1);
    active.splice(event.detail.to, 0, movedItem);
    try {
      await this.ballsStore.reorderArsenal(active);
    } catch {
      this.toastService.showToast(TOAST_MESSAGES.ballSaveError, 'bug', true);
    }
  }

  /** Retires a ball, or brings a retired one back into use. */
  async setRetired(ball: Ball, retired: boolean): Promise<void> {
    if (retired === !!ball.retiredAt) return;
    try {
      this.hapticService.vibrate(ImpactStyle.Light);
      await this.ballsStore.setBallRetired(ball, retired);
      this.toastService.showToast(retired ? TOAST_MESSAGES.ballRetireSuccess : TOAST_MESSAGES.ballRestoreSuccess, 'checkmark-outline');
    } catch {
      this.toastService.showToast(TOAST_MESSAGES.ballRetireError, 'bug', true);
    }
  }

  async onNotesChange(ball: Ball, field: 'nickname' | 'note', raw: string | number | null | undefined): Promise<void> {
    try {
      await this.ballsStore.updateBallNotes(ball, { nickname: ball.nickname, note: ball.note, [field]: raw?.toString() ?? '' });
    } catch {
      this.toastService.showToast(TOAST_MESSAGES.ballNotesSaveError, 'bug', true);
    }
  }

  onDetailSegmentChange(value: unknown): void {
    this.detailSegment.set(value === 'drilling' || value === 'notes' ? value : 'ball');
  }

  /** The arsenals: switch to one, or create, rename or delete one. */
  async openArsenalMenu(): Promise<void> {
    const current = this.ballsStore.currentArsenal();
    const arsenals = this.ballsStore.arsenals();
    const buttons: ActionSheetButton[] = arsenals.map((arsenal) => ({
      text: arsenal.name,
      icon: arsenal.id === current?.id ? 'checkmark-outline' : undefined,
      handler: () => void this.ballsStore.setCurrentArsenal(arsenal.id),
    }));
    buttons.push({ text: 'New Arsenal', icon: 'add', handler: () => void this.promptArsenalName() });
    if (current) {
      buttons.push({
        text: `Rename "${current.name}"`,
        icon: 'create-outline',
        handler: () => void this.promptArsenalName(current.id, current.name),
      });
    }
    if (current && arsenals.length > 1) {
      buttons.push({ text: `Delete "${current.name}"`, icon: 'trash-outline', role: 'destructive', handler: () => void this.confirmDeleteArsenal() });
    }
    buttons.push({ text: 'Cancel', role: 'cancel' });
    const sheet = await this.actionSheetController.create({ header: 'Arsenals', buttons });
    await sheet.present();
  }

  /** Creates the arsenal, or renames the one with `id`. False for a name that can't be used. */
  async saveArsenalName(name: string, id?: string): Promise<boolean> {
    try {
      if (id) {
        await this.ballsStore.renameArsenal(id, name);
      } else {
        await this.ballsStore.createArsenal(name);
      }
      this.toastService.showToast(TOAST_MESSAGES.arsenalSaveSuccess, 'checkmark-outline');
      return true;
    } catch (error) {
      const message =
        error instanceof ArsenalNameError
          ? error.reason === 'taken'
            ? TOAST_MESSAGES.arsenalNameTaken
            : TOAST_MESSAGES.arsenalNameMissing
          : TOAST_MESSAGES.arsenalSaveError;
      this.toastService.showToast(message, 'bug', true);
      return false;
    }
  }

  /** Which arsenals a ball is in. */
  async editBallArsenals(ball: Ball): Promise<void> {
    const before = this.ballsStore.arsenalsOf(ball);
    const picked = await this.arsenalPicker.choose(`Arsenals for ${ball.ball_name}`, before);
    if (!picked) return;
    await this.ballsStore.setBallArsenals(ball, picked);
  }

  /**
   * Adds catalog balls to the arsenal, into `arsenalIds` (the open arsenal by default); with `allowTwin`
   * also ones the bowler already has.
   */
  async saveBallToArsenal(balls: Ball[], allowTwin = false, arsenalIds?: string[]): Promise<void> {
    if (balls.length === 0) return;
    const { added, failed } = await this.ballsStore.addBallsToArsenal(balls, { allowTwin, arsenalIds });

    if (added.length) {
      this.toastService.showToast(`Balls added to arsenal: ${added.map((b) => b.ball_name).join(', ')}`, 'checkmark-outline');
    }
    if (failed.length) {
      this.toastService.showToast(`Failed to add: ${failed.map((b) => b.ball_name).join(', ')}.`, 'bug', true);
    }
    if (added.length) {
      await this.promptForDrilling(added);
    }
  }

  openBallDetail(ball: Ball, segment: DetailSegment = 'ball'): void {
    this.detailSegment.set(segment);
    this.openBallId.set(ball.arsenalId ?? null);
  }

  // The segment's initial value doesn't move the segment view, so jump it to the selected tab once the modal is shown.
  async syncDetailSegmentView(event: Event): Promise<void> {
    const view = (event.target as HTMLElement).querySelector('ion-segment-view');
    const contentId = { ball: 'ball-detail', drilling: 'ball-drilling', notes: 'ball-notes' }[this.detailSegment()];
    await view?.setContent(contentId, false);
  }

  closeBallDetail(): void {
    this.openBallId.set(null);
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

  async onBallSelectionChange(selected: Ball[]): Promise<void> {
    const arsenal = this.ballsStore.arsenal();
    const here = this.ballsStore.currentArsenalBalls();
    const fresh = selected.filter((ball) => !isInArsenal(ball, arsenal));
    // owned, but only in other arsenals: it joins this one, it isn't bought a second time
    const elsewhere = selected.filter((ball) => isInArsenal(ball, arsenal) && !isInArsenal(ball, here));
    const twins = selected.filter((ball) => isInArsenal(ball, here));

    for (const ball of elsewhere) {
      const entry = arsenal.find((owned) => ballKey(owned) === ballKey(ball));
      const current = this.ballsStore.currentArsenal();
      if (entry && current) await this.ballsStore.setBallArsenals(entry, [...this.ballsStore.arsenalsOf(entry), current.id]);
    }
    if (elsewhere.length) {
      this.toastService.showToast(`Balls added to arsenal: ${elsewhere.map((b) => b.ball_name).join(', ')}`, 'checkmark-outline');
    }

    const again = twins.length && (await this.confirmAddTwins(twins)) ? twins : [];
    if (fresh.length + again.length === 0) return;
    const arsenalIds = await this.arsenalPicker.chooseForNewBalls();
    if (!arsenalIds) return;
    await this.saveBallToArsenal(fresh, false, arsenalIds);
    await this.saveBallToArsenal(again, true, arsenalIds);
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

    const key = ball.arsenalId ?? ball.key;
    this.loadingWeightBallIds.update((s) => new Set([...s, key]));

    try {
      const replacementBall = await this.ballService.getBallVariant(ball.ball_id, selectedWeight);

      if (!replacementBall) {
        selectEl.value = ball.core_weight;
        this.toastService.showToast('Selected weight is unavailable for this ball.', 'alert-circle-outline', true);
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

  private async promptArsenalName(id?: string, name = ''): Promise<void> {
    const alert = await this.alertController.create({
      header: id ? 'Rename Arsenal' : 'New Arsenal',
      inputs: [{ name: 'name', type: 'text', value: name, placeholder: 'e.g. Tournament', attributes: { maxlength: 30 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        // stays open for a name that can't be used
        { text: 'Save', handler: (data: { name: string }) => this.saveArsenalName(data.name, id) },
      ],
    });
    await alert.present();
  }

  private async confirmDeleteArsenal(): Promise<void> {
    const current = this.ballsStore.currentArsenal();
    if (!current) return;
    const alert = await this.alertController.create({
      header: 'Delete Arsenal?',
      message: `Delete "${current.name}"? Its balls stay yours: any that are in no other arsenal move to another one.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.ballsStore.deleteArsenal(current.id);
            this.toastService.showToast(TOAST_MESSAGES.arsenalDeleteSuccess, 'checkmark-outline');
          },
        },
      ],
    });
    await alert.present();
  }

  // A ball picked again is most likely a second one of it (e.g. drilled differently), but it's asked, not assumed.
  private async confirmAddTwins(owned: Ball[]): Promise<boolean> {
    const names = owned.map((ball) => `${ball.ball_name} ${ball.core_weight}lbs`).join(', ');
    const alert = await this.alertController.create({
      header: owned.length === 1 ? 'Add another one?' : 'Add more of these?',
      message:
        owned.length === 1
          ? `${names} is already in your arsenal. Add a second one, e.g. with a different layout?`
          : `Already in your arsenal: ${names}. Add a second one of each, e.g. with a different layout?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: owned.length === 1 ? 'Add Another' : 'Add', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
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
