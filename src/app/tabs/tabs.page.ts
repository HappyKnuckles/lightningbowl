import { Component, inject } from '@angular/core';
import { addIcons } from 'ionicons';
import {
  add,
  statsChartOutline,
  receipt,
  medalOutline,
  bowlingBallOutline,
  ellipsisHorizontal,
  bagAddOutline,
  settingsOutline,
  mapOutline,
  gameControllerOutline,
  scaleOutline,
} from 'ionicons/icons';
import { BehaviorSubject } from 'rxjs';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonContent, IonList, IonItem, IonModal } from '@ionic/angular/standalone';
import { AsyncPipe } from '@angular/common';
interface MoreTab {
  path: string;
  label: string;
  icon?: string;
  src?: string;
}
@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonModal, RouterModule, AsyncPipe, IonItem, IonList, IonContent, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  private router = inject(Router);

  activeMoreTab$ = new BehaviorSubject<boolean>(false);
  readonly moreTabs: MoreTab[] = [
    {
      path: '/tabs/arsenal',
      label: 'Arsenal',
      src: 'assets/svg/ball-bag-svgrepo-com.svg',
    },
    {
      path: '/tabs/balls',
      label: 'Ball Library',
      icon: 'bowling-ball-outline',
    },
    {
      path: '/tabs/ball-comparison',
      label: 'Ball Comparison',
      icon: 'scale-outline',
    },
    {
      path: '/tabs/pattern',
      label: 'Pattern Library',
      src: 'assets/svg/lane.svg',
    },
    {
      path: '/tabs/map',
      label: 'Map',
      icon: 'map-outline',
    },
    {
      path: '/tabs/minigame',
      label: 'Minigame',
      icon: 'game-controller-outline',
    },
    {
      path: '/tabs/settings',
      label: 'Settings',
      icon: 'settings-outline',
    },
  ];

  private tabPaths = this.moreTabs.map((t) => t.path);
  constructor() {
    addIcons({
      add,
      statsChartOutline,
      receipt,
      medalOutline,
      ellipsisHorizontal,
      bowlingBallOutline,
      mapOutline,
      settingsOutline,
      bagAddOutline,
      gameControllerOutline,
      scaleOutline,
    });

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const isMoreActive = this.tabPaths.some((path) => this.router.url.includes(path));
      this.activeMoreTab$.next(isMoreActive);
    });
  }
}
