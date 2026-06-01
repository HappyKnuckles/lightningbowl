import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import emailjs from '@emailjs/browser';
import { AlertController, InputCustomEvent, ModalController } from '@ionic/angular';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bugOutline,
  chevronBack,
  chevronBackOutline,
  cloudUploadOutline,
  colorPaletteOutline,
  logoGithub,
  mailOutline,
  personCircleOutline,
  refreshCircleOutline,
  sendOutline,
} from 'ionicons/icons';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { CloudSyncService } from 'src/app/core/services/cloud-sync/cloud-sync.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { ThemeChangerService } from 'src/app/core/services/theme-changer/theme-changer.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UserService } from 'src/app/core/services/user/user.service';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { CloudSyncSettingsComponent } from 'src/app/shared/components/cloud-sync-settings/cloud-sync-settings.component';
import { GithubIssuesModalComponent } from 'src/app/shared/components/github-issues-modal/github-issues-modal.component';
import { LeagueSelectorComponent } from 'src/app/shared/components/league-selector/league-selector.component';
import { SpareNamesComponent } from 'src/app/shared/components/spare-names/spare-names.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  providers: [ModalController],
  imports: [
    IonList,
    IonButtons,
    IonModal,
    IonTextarea,
    IonButton,
    IonLabel,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonCard,
    IonItem,
    IonTitle,
    IonIcon,
    IonInput,
    IonContent,
    IonToolbar,
    IonHeader,
    IonSelect,
    IonSelectOption,
    IonNote,
    NgClass,
    NgFor,
    NgIf,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    LeagueSelectorComponent,
    SpareNamesComponent,
  ],
})
export class SettingsPage implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private hasHandledAuthCallback = false;
  private hasOpenedCloudSyncModal = false;
  currentColor: string | null = '';
  optionsWithClasses: { name: string; class: string }[] = [
    { name: 'Blue', class: 'blue-option' },
    { name: 'Lila', class: 'lila-option' },
    { name: 'Green', class: 'green-option' },
    { name: 'Red', class: 'red-option' },
    { name: 'Gray', class: 'gray-option' },
  ];
  isTestEnvironment = environment.branch === 'test';
  userEmail = '';
  feedbackMessage = '';
  updateAvailable = false;
  constructor(
    public userService: UserService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private themeService: ThemeChangerService,
    private statsService: GameStatsService,
    private alertCtrl: AlertController,
    private analyticsService: AnalyticsService,
    public settingsStore: SettingsStore,
    public cloudSyncService: CloudSyncService,
    private route: ActivatedRoute,
  ) {
    addIcons({
      personCircleOutline,
      colorPaletteOutline,
      logoGithub,
      mailOutline,
      refreshCircleOutline,
      chevronBackOutline,
      addOutline,
      chevronBack,
      sendOutline,
      bugOutline,
      cloudUploadOutline,
    });
  }

  ngOnInit(): void {
    this.currentColor = this.themeService.getCurrentTheme();
    this.updateAvailable = localStorage.getItem('update') !== null ? true : false;
  }

  ngAfterViewInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const provider = params['provider'];
      const status = params['status'];
      const error = params['error'] || params['message'];
      const shouldOpenCloudSync = params['openCloudSync'] === 'true' || params['openModal'] === 'true' || (provider && status);

      if (provider && status && !this.hasHandledAuthCallback) {
        this.hasHandledAuthCallback = true;
        void this.cloudSyncService.handleAuthCallback(provider, status, error || undefined).catch((err) => {
          console.error('Auth callback handling failed:', err);
        });
      }

      if (shouldOpenCloudSync && !this.hasOpenedCloudSyncModal) {
        this.hasOpenedCloudSyncModal = true;
        void this.openSyncModal();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });
  }

  async openSyncModal() {
    const modal = await this.modalCtrl.create({
      component: CloudSyncSettingsComponent,
    });

    return await modal.present();
  }

  async openGithubIssueModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: GithubIssuesModalComponent,
    });

    await modal.present();
  }

  changeName(event: InputCustomEvent): void {
    const username = event.detail.value;
    if (username) {
      this.userService.setUsername(username);
    }
  }

  savePinInputMode(pinMode: string): void {
    this.settingsStore.savePinInputMode(pinMode);
  }

  async getGameCountForAverage(event: InputCustomEvent): Promise<void> {
    const targetAvgString = event.detail.value;
    if (!targetAvgString) {
      return;
    }
    const targetAvg = parseInt(targetAvgString, 10);
    if (isNaN(targetAvg)) {
      console.error('Invalid target average input');
      return;
    }

    const results = this.statsService.calculateGamesForTargetAverage(targetAvg, 10);

    let message = '';

    if (results.every((res) => res.gamesNeeded === 0)) {
      message = `Your current average is already ${results[0].score} or higher. No additional games needed to reach ${targetAvg}.`;
    } else {
      message = results
        .map((result) => {
          const gamesNeededText = result.gamesNeeded === Infinity ? 'Very high' : result.gamesNeeded.toString();
          return `${gamesNeededText} games needed with ${result.score} total`;
        })
        .join('<br>');
    }

    const alert = await this.alertCtrl.create({
      header: `Games Needed for ${targetAvg} Average`,
      message: message,
      buttons: ['OK'],
    });

    await alert.present();
  }

  changeColor(): void {
    this.themeService.saveColorTheme(this.currentColor!);
    this.toastService.showToast(`Changed theme to ${this.currentColor}.`, 'checkmark-outline');

    void this.analyticsService.trackThemeChanged(this.currentColor!);
  }

  updateApp(): void {
    localStorage.removeItem('update');
    window.location.reload();
  }

  async submitFeedback(form: NgForm): Promise<void> {
    if (form.valid) {
      const templateParams = {
        from_name: this.userEmail,
        message: this.feedbackMessage,
        to_name: 'Lightning Bowl',
      };
      this.loadingService.setLoading(true);
      try {
        await emailjs.send(environment.emailServiceID, environment.emailTemplateID, templateParams, environment.emailUserID);
        this.userEmail = '';
        this.feedbackMessage = '';
        this.toastService.showToast(TOAST_MESSAGES.feedbackUploadSuccess, 'checkmark-outline');
        form.resetForm();
      } catch (error) {
        console.error('ERROR...', error);
        this.toastService.showToast(TOAST_MESSAGES.feedbackUploadError, 'bug-outline', true);
      } finally {
        this.loadingService.setLoading(false);
      }
    } else {
      alert('Please fill out all fields correctly.');
    }
  }
}
