import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, IonApp, IonBackdrop, IonSpinner, IonRouterOutlet } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { NgIf } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { LoadingService } from './core/services/loader/loading.service';
import { ToastService } from './core/services/toast/toast.service';
import { UserService } from './core/services/user/user.service';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeChangerService } from './core/services/theme-changer/theme-changer.service';
import { PwaInstallService } from './core/services/pwa-install/pwa-install.service';
import { PwaInstallPromptComponent } from './shared/components/pwa-install-prompt/pwa-install-prompt.component';
import { AnalyticsService } from './core/services/analytics/analytics.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, NgIf, IonBackdrop, IonSpinner, IonRouterOutlet, ToastComponent, PwaInstallPromptComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly GREETING_THROTTLE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private pwaInstallSubscription: Subscription;
  private updateInterval: any;
  showPwaInstallPrompt = false;
  canInstallPwa = false;

  constructor(
    private alertController: AlertController,
    private toastService: ToastService,
    public loadingService: LoadingService,
    private userService: UserService,
    private swUpdate: SwUpdate,
    private themeService: ThemeChangerService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private pwaInstallService: PwaInstallService,
    private analyticsService: AnalyticsService,
    private router: Router,
  ) {
    // Initialize service worker updates for all platforms
    this.initializeApp();
    const currentTheme = this.themeService.getCurrentTheme();
    this.themeService.applyTheme(currentTheme);

    this.pwaInstallSubscription = this.pwaInstallService.canShowInstallPrompt().subscribe((canShow) => {
      this.showPwaInstallPrompt = canShow;
      this.canInstallPwa = this.pwaInstallService.isInstallable();
    });
  }

  async ngOnInit(): Promise<void> {
    this.greetUser();

    await this.analyticsService.trackAppLaunched();

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      void this.analyticsService.trackRouteChange(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    if (this.pwaInstallSubscription) {
      this.pwaInstallSubscription.unsubscribe();
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  private initializeApp(): void {
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        const branch = environment.branch || 'master';
        const lastCommitDateKey = `lastCommitDate_${branch}`;
        const lastCommitDate = localStorage.getItem(lastCommitDateKey);
        const sinceParam = lastCommitDate ? `&since=${lastCommitDate}` : '';
        const apiUrl = `https://api.github.com/repos/HappyKnuckles/Lightning-Bowl/commits?sha=${branch}${sinceParam}`;

        // Fetch the latest commits from the current branch on GitHub
        this.http.get(apiUrl).subscribe({
          next: async (data: any) => {
            const newCommits = [];

            for (const commit of data) {
              const commitDate = new Date(commit.commit.committer.date).toISOString();
              if (commitDate !== lastCommitDate) {
                newCommits.push(commit.commit.message);
              }
            }

            if (newCommits.length > 0) {
              const commitMessages = newCommits.map((msg) => `<li>${msg}</li>`).join('');
              const sanitizedMessage = this.sanitizer.sanitize(
                1,
                `<div class="commit-message"><ul>${commitMessages}</ul><br><span class="load-text">Load it?</span></div>`,
              );

              const alert = await this.alertController.create({
                backdropDismiss: false,
                header: 'New Version Available',
                subHeader: 'Following changes were made:',
                message: sanitizedMessage || '',
                buttons: [
                  {
                    text: 'Cancel',
                    role: 'cancel',
                    handler: () => {
                      localStorage.setItem(lastCommitDateKey, new Date(data[0].commit.committer.date).toISOString());
                      localStorage.setItem('update', 'true');
                    },
                  },
                  {
                    text: 'Load',
                    handler: () => {
                      localStorage.setItem(lastCommitDateKey, new Date(data[0].commit.committer.date).toISOString());
                      window.location.reload();
                    },
                  },
                ],
              });
              await alert.present();
            }
          },
          error: async (error) => {
            console.error('Failed to fetch the latest commits:', error);
            const alert = await this.alertController.create({
              backdropDismiss: false,
              header: 'New Version Available',
              message: 'A new version is available. Load it?',
              buttons: [
                {
                  text: 'Cancel',
                  role: 'cancel',
                  handler: () => {
                    localStorage.setItem('update', 'true');
                  },
                },
                {
                  text: 'Load',
                  handler: () => {
                    window.location.reload();
                  },
                },
              ],
            });
            await alert.present();
          },
        });
      }
    });

    this.updateInterval = setInterval(
      () => {
        this.swUpdate.checkForUpdate();
      },
      15 * 60 * 1000,
    );
  }

  private async greetUser(): Promise<void> {
    if (environment.production) {
      if (!this.userService.username()) {
        await this.showEnterNameAlert();
      } else {
        // Check if we should show the greeting based on last greeting time
        const lastGreetingData = localStorage.getItem('lastGreeting');
        let shouldShowGreeting = true;

        if (lastGreetingData) {
          try {
            const { expiration } = JSON.parse(lastGreetingData);
            // Only show greeting if the expiration time has passed
            if (expiration && new Date().getTime() < expiration) {
              shouldShowGreeting = false;
            }
          } catch {
            // If data is corrupted, remove it and show greeting
            localStorage.removeItem('lastGreeting');
          }
        }

        if (shouldShowGreeting) {
          this.presentGreetingAlert(this.userService.username());
        }
      }
    }
  }

  private async showEnterNameAlert() {
    const alert = await this.alertController.create({
      header: 'Welcome!',
      message: 'Please enter your name:',
      inputs: [
        {
          name: 'username',
          type: 'text',
          placeholder: 'Your Name',
          cssClass: 'alert-input',
        },
      ],
      buttons: [
        {
          text: 'Confirm',
          handler: (data) => {
            const newName = data.username.trim();
            if (newName !== '') {
              this.userService.setUsername(newName);
              this.toastService.showToast(`Name updated to ${this.userService.username()}`, 'reload-outline');
            }
          },
        },
      ],
      cssClass: 'alert-header-white alert-message-white',
    });

    await alert.present();
  }

  async onPwaInstall(): Promise<void> {
    try {
      const installed = await this.pwaInstallService.triggerInstall();
      if (installed) {
        this.toastService.showToast('App installed successfully!', 'checkmark-circle', false);
        this.showPwaInstallPrompt = false;
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
      this.toastService.showToast('Installation failed. Please try again.', 'alert-circle', true);
    }
  }

  onPwaDismiss(): void {
    this.pwaInstallService.dismissInstallPrompt();
    this.showPwaInstallPrompt = false;
  }

  private async presentGreetingAlert(name: string): Promise<void> {
    const alert = await this.alertController.create({
      header: `Hello ${name}!`,
      buttons: [
        {
          text: 'Hi',
        },
        {
          text: 'Change Name',
          handler: () => {
            this.showEnterNameAlert();
          },
        },
      ],
      cssClass: 'alert-header-white alert-message-white',
    });

    await alert.present();

    // Store the greeting timestamp with 7-day expiration
    alert.onDidDismiss().then(() => {
      const expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + this.GREETING_THROTTLE_DURATION_MS);
      const greetingData = { expiration: expirationDate.getTime() };
      localStorage.setItem('lastGreeting', JSON.stringify(greetingData));
    });
  }
}
