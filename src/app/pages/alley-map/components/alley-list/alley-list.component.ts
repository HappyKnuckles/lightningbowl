import { Component, computed, inject, input, output } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { heart, timeOutline } from 'ionicons/icons';
import { Alley } from 'src/app/core/models/alley.model';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { getOpenState } from 'src/app/core/utils/opening-hours.util';
import { DistancePipe } from 'src/app/shared/pipes/distance-pipe/distance.pipe';

@Component({
  selector: 'app-alley-list',
  imports: [IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonTitle, IonToolbar, DistancePipe, IonBadge],
  templateUrl: './alley-list.component.html',
  styleUrl: './alley-list.component.scss',
})
export class AlleyListComponent {
  alleys = input.required<Alley[]>();
  alleySelected = output<Alley>();

  private favoritesService = inject(AlleyFavoritesService);

  recents = computed(() => {
    const shownIds = new Set(this.alleys().map((a) => a.id));
    return this.favoritesService
      .recents()
      .filter((r) => !shownIds.has(r.id))
      .slice(0, 3);
  });

  constructor() {
    addIcons({ heart, timeOutline });
  }

  isFavorite(alley: Alley): boolean {
    return this.favoritesService.favorites().has(alley.id);
  }

  openState(alley: Alley): 'open' | 'closed' | 'unknown' {
    return getOpenState(alley.openingHours);
  }
}
