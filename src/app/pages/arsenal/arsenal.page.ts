import { CommonModule } from '@angular/common';
import { Component, ElementRef, Signal, ViewChild, computed, effect, model, signal } from '@angular/core';
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
import { add, chevronBack, chevronDownOutline, ellipsisVerticalOutline, openOutline, trashOutline } from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { Ball } from 'src/app/core/models/ball.model';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { ChartGenerationService } from 'src/app/core/services/chart/chart-generation.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { ToastService } from 'src/app/core/services/toast/toast.service';
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
    CommonModule,
    FormsModule,
    BallListComponent,
    GenericTypeaheadComponent,
    IonSegmentContent,
    IonSegmentView,
    IonCard,
    IonCardContent,
    IonSelect,
    IonSelectOption,
  ],
})
export class ArsenalPage {
  @ViewChild('core', { static: false }) coreModal!: IonModal;
  @ViewChild('coverstock', { static: false }) coverstockModal!: IonModal;
  coverstockBalls: Ball[] = [];
  coreBalls: Ball[] = [];
  presentingElement: HTMLElement = document.querySelector('.ion-page')!;

  ballTypeaheadConfig: TypeaheadConfig<Ball> = this.typeaheadConfigService.ball;
  ballsWithoutArsenal: Signal<Ball[]> = computed(() =>
    this.ballsStore
      .allBalls()
      .filter((ball) => !this.ballsStore.arsenal().some((b) => b.ball_id === ball.ball_id && b.core_weight === ball.core_weight)),
  );
  selectedSegment = model('arsenal');
  @ViewChild('balls', { static: false }) ballChart?: ElementRef;
  private ballsChartInstance: Chart | null = null;
  readonly loadingWeightBallIds = signal<Set<string>>(new Set());
  readonly availableWeights = ['12', '13', '14', '15', '16'];

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
  ) {
    addIcons({ add, ellipsisVerticalOutline, trashOutline, chevronBack, openOutline, chevronDownOutline });
    effect(() => {
      if (this.selectedSegment() === 'compare') {
        this.generateBallDistributionChart();
      }
    });
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
      this.toastService.showToast(ToastMessages.chartGenerationError, 'bug', true);
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
                this.toastService.showToast(ToastMessages.ballDeleteError, 'bug', true);
              }
            },
          },
        ],
      });

      await alert.present();
    } catch (error) {
      console.error('Error displaying removal alert:', error);
      this.toastService.showToast(ToastMessages.unexpectedError, 'warning', true);
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

  saveBallToArsenal(ball: Ball[]): void {
    try {
      ball.forEach(async (ball) => {
        try {
          await this.ballsStore.saveBallToArsenal(ball);
        } catch (error) {
          console.error(`Error saving ball ${ball.ball_name} to arsenal:`, error);
          this.toastService.showToast(`Failed to add ${ball.ball_name}.`, 'bug', true);
        }
      });

      const ball_names = ball.map((ball) => ball.ball_name).join(', ');
      this.toastService.showToast(`Balls added to arsenal: ${ball_names}`, 'checkmark-outline');
    } catch (error) {
      console.error('Error saving balls to arsenal:', error);
      this.toastService.showToast(ToastMessages.ballSaveError, 'bug', true);
    }
  }

  onBallSelectionChange(ballIds: string[]): void {
    const selectedBalls = this.ballsWithoutArsenal().filter((ball) => ballIds.includes(ball.ball_id));
    this.saveBallToArsenal(selectedBalls);
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
      const ballsAtWeight = await this.ballService.getBallsByWeight(selectedWeight);
      const replacementBall = ballsAtWeight.find((c) => c.ball_id === ball.ball_id);

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
      this.toastService.showToast(ToastMessages.ballLoadError, 'alert-circle-outline', true);
    } finally {
      this.loadingWeightBallIds.update((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }
}
