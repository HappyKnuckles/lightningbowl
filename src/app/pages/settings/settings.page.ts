import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
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
  colorPaletteOutline,
  logoGithub,
  mailOutline,
  personCircleOutline,
  refreshCircleOutline,
  sendOutline,
} from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
import { GameStatsService } from 'src/app/core/services/game-stats/game-stats.service';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ThemeChangerService } from 'src/app/core/services/theme-changer/theme-changer.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { UserService } from 'src/app/core/services/user/user.service';
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
    NgClass,
    NgFor,
    FormsModule,
    ReactiveFormsModule,
    LeagueSelectorComponent,
    SpareNamesComponent,
    NgIf,
  ],
})
export class SettingsPage implements OnInit {
  private modalCtrl = inject(ModalController);
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
    public storageService: StorageService,
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
    });
  }

  ngOnInit(): void {
    this.currentColor = this.themeService.getCurrentTheme();
    this.updateAvailable = localStorage.getItem('update') !== null ? true : false;
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
    this.storageService.savePinInputMode(pinMode);
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
        this.toastService.showToast(ToastMessages.feedbackUploadSuccess, 'checkmark-outline');
        form.resetForm();
      } catch (error) {
        console.error('ERROR...', error);
        this.toastService.showToast(ToastMessages.feedbackUploadError, 'bug-outline', true);
      } finally {
        this.loadingService.setLoading(false);
      }
    } else {
      alert('Please fill out all fields correctly.');
    }
  }
}
