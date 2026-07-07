import { Component, computed, inject, input } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  callOutline,
  clipboardOutline,
  globeOutline,
  heart,
  heartOutline,
  locationOutline,
  navigateOutline,
  shareSocialOutline,
  timeOutline,
} from 'ionicons/icons';
import { Alley } from 'src/app/core/models/alley.model';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { HapticService } from 'src/app/core/services/haptic/haptic.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { formatOpeningHours, getOpenState } from 'src/app/core/utils/opening-hours.util';
import { DistancePipe } from 'src/app/shared/pipes/distance-pipe/distance.pipe';

@Component({
  selector: 'app-alley-detail-sheet',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar, DistancePipe],
  templateUrl: './alley-detail-sheet.component.html',
  styleUrl: './alley-detail-sheet.component.scss',
})
export class AlleyDetailSheetComponent {
  alley = input.required<Alley>();

  private favoritesService = inject(AlleyFavoritesService);
  private hapticService = inject(HapticService);
  private toastService = inject(ToastService);

  openState = computed(() => getOpenState(this.alley().openingHours));
  hoursLines = computed(() => (this.alley().openingHours ? formatOpeningHours(this.alley().openingHours!) : []));
  isFavorite = computed(() => this.favoritesService.favorites().has(this.alley().id));

  constructor() {
    addIcons({ callOutline, clipboardOutline, globeOutline, heart, heartOutline, locationOutline, navigateOutline, shareSocialOutline, timeOutline });
  }

  navigate(): void {
    const { lat, lon } = this.alley();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');
    void this.hapticService.vibrate(ImpactStyle.Light);
  }

  call(): void {
    const phone = this.alley().phone;
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    }
  }

  openWebsite(): void {
    const website = this.alley().website;
    if (website) {
      window.open(website, '_blank', 'noopener');
    }
  }

  async share(): Promise<void> {
    const { name, lat, lon, address } = this.alley();
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
    const text = address ? `${name} — ${address}` : name;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: name, text, url, dialogTitle: `Share ${name}` });
      } catch {
        // user dismissed the share sheet
      }
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        await this.copyToClipboard(text, url);
      }
      return;
    }

    await this.copyToClipboard(text, url);
  }

  private async copyToClipboard(text: string, url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.toastService.showToast('Link copied to clipboard', 'clipboard-outline');
    } catch {
      this.toastService.showToast('Sharing is not supported on this device.', 'share-social-outline', true);
    }
  }

  toggleFavorite(): void {
    const isFavorited = this.favoritesService.toggleFavorite(this.alley());
    void this.hapticService.vibrate(ImpactStyle.Light);
    this.toastService.showToast(isFavorited ? 'Added to favorite alleys' : 'Removed from favorite alleys', isFavorited ? 'heart' : 'heart-outline');
  }
}
