import { Component } from '@angular/core';
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
} from 'ionicons/icons';
import { BehaviorSubject } from 'rxjs';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonContent, IonList, IonItem, IonModal } from '@ionic/angular/standalone';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonModal, RouterModule, AsyncPipe, IonItem, IonList, IonContent, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TranslateModule],
})
export class TabsPage {
  activeMoreTab$ = new BehaviorSubject<boolean>(false);
  readonly moreTabs = ['/tabs/arsenal', '/tabs/balls', '/tabs/pattern', '/tabs/map', '/tabs/minigame', '/tabs/settings'];

  constructor(private router: Router) {
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
    });

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.activeMoreTab$.next(this.moreTabs.some((tab) => this.router.url.includes(tab)));
    });
  }

  isActive(path: string): boolean {
    return this.router.url.includes(path);
  }
}
