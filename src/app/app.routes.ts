import { Routes } from '@angular/router';
import { TabsPage } from './tabs/tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'add',
        loadComponent: () => import('./pages/add-game/add-game.page').then((m) => m.AddGamePage),
      },
      {
        path: 'stats',
        loadComponent: () => import('./pages/stats/stats.page').then((m) => m.StatsPage),
      },
      {
        path: 'history',
        loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage),
      },
      {
        path: 'league',
        loadComponent: () => import('./pages/league/league.page').then((m) => m.LeaguePage),
      },
      {
        path: 'balls',
        loadComponent: () => import('./pages/balls/balls.page').then((m) => m.BallsPage),
      },
      {
        path: 'arsenal',
        loadComponent: () => import('./pages/arsenal/arsenal.page').then((m) => m.ArsenalPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'pattern',
        loadComponent: () => import('./pages/pattern/pattern.page').then((m) => m.PatternPage),
      },
      {
        path: 'map',
        loadComponent: () => import('./pages/alley-map/alley-map.page').then((m) => m.AlleyMapPage),
      },
      {
        path: 'minigame',
        loadComponent: () => import('./pages/minigame/minigame.page').then((m) => m.MinigamePage),
      },
      {
        path: '',
        redirectTo: '/tabs/add',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/add',
    pathMatch: 'full',
  },
];
