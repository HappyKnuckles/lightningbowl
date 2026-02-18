import { Component, OnInit, inject } from '@angular/core';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { Router, ActivatedRoute } from '@angular/router';
import { CloudSyncService } from 'src/app/core/services/cloud-sync/cloud-sync.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content class="ion-padding ion-text-center">
      <div style="margin-top: 50%; transform: translateY(-50%)">
        <ion-spinner name="crescent"></ion-spinner>
        <p style="margin-top: 20px">Completing authentication...</p>
      </div>
    </ion-content>
  `,
})
export class AuthCallbackPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cloudSyncService = inject(CloudSyncService);

  async ngOnInit(): Promise<void> {
    // The backend redirects here with query params: ?provider=xxx&status=success|error&error=...
    const params = this.route.snapshot.queryParams;
    const provider = params['provider'];
    const status = params['status'];
    const error = params['error'];
    const openModal = params['openModal'];

    if (provider && status) {
      try {
        await this.cloudSyncService.handleAuthCallback(provider, status, error || undefined);
      } catch (err) {
        console.error('Auth callback handling failed:', err);
      }
    }

    // Navigate to settings page, preserving openModal param
    // Always navigate regardless of any errors above
    const queryParams = openModal === 'true' ? { openCloudSync: 'true' } : {};
    this.router.navigate(['/tabs/settings'], { replaceUrl: true, queryParams });
  }
}
