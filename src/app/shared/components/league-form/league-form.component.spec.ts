import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { vi } from 'vitest';

import { Game } from 'src/app/core/models/game.model';
import { League } from 'src/app/core/models/league.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { GamesStore } from 'src/app/core/stores/games.store';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';
import { startOfDay, toDateInput } from 'src/app/core/utils/league-utils/league.utils';
import { makeGame } from 'src/testing/fixtures';

import { LeagueFormComponent } from './league-form.component';

describe('LeagueFormComponent', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  const games = signal<Game[]>([]);
  const leagueList = signal<League[]>([]);
  const leaguesStore = {
    leagues: computed(() => leagueList().map((league) => league.name)),
    addLeague: vi.fn(),
  };
  const appFacade = { updateLeague: vi.fn() };
  const modalCtrl = { dismiss: vi.fn() };
  const toast = { showToast: vi.fn() };

  let fixture: ComponentFixture<LeagueFormComponent>;
  let component: LeagueFormComponent;

  const create = (league?: League, newSeason = false) => {
    fixture = TestBed.createComponent(LeagueFormComponent);
    component = fixture.componentInstance;
    component.league = league;
    component.newSeason = newSeason;
    fixture.detectChanges();
  };

  const input = (value: string) => new CustomEvent('ionInput', { detail: { value } });

  beforeEach(() => {
    vi.clearAllMocks();
    games.set([]);
    leagueList.set([{ name: 'Sunday', type: 'league', seasons: [], createdAt: 0 }]);
    leaguesStore.addLeague.mockResolvedValue(undefined);
    appFacade.updateLeague.mockResolvedValue(undefined);
    modalCtrl.dismiss.mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [LeagueFormComponent],
      providers: [
        { provide: LeaguesStore, useValue: leaguesStore },
        { provide: GamesStore, useValue: { games } },
        { provide: AppFacade, useValue: appFacade },
        { provide: ModalController, useValue: modalCtrl },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('creates a league with a first season starting today', async () => {
    create();
    component.setName(input('  Thursday Night  '));

    await component.save();

    const saved: League = leaguesStore.addLeague.mock.calls[0][0];
    expect(saved).toMatchObject({ name: 'Thursday Night', type: 'league' });
    expect(saved.seasons).toHaveLength(1);
    expect(saved.seasons[0].start).toBe(startOfDay(Date.now()));
    expect(modalCtrl.dismiss).toHaveBeenCalledWith(saved, 'confirm');
  });

  it('needs a name that no other league has', async () => {
    create();
    expect(component.error()).toBe('Enter a name.');

    component.setName(input('sunday'));
    expect(component.error()).toBe('A league with this name already exists.');

    await component.save();
    expect(leaguesStore.addLeague).not.toHaveBeenCalled();
  });

  it("doesn't take two seasons starting on the same day", () => {
    create();
    component.setName(input('Thursday'));
    component.startNewSeason();

    expect(component.error()).toBe("Two seasons can't start on the same day.");
  });

  it('saves a renamed tournament without seasons, moving its games through the facade', async () => {
    const league: League = { name: 'Cup', type: 'league', seasons: [{ id: 's', name: '2026', start: day('2026-05-01') }], createdAt: 7 };
    leagueList.set([league]);
    create(league);
    component.setName(input('City Cup'));
    component.setType(new CustomEvent('ionChange', { detail: { value: 'tournament' } }));

    await component.save();

    expect(appFacade.updateLeague).toHaveBeenCalledWith({ name: 'City Cup', type: 'tournament', seasons: [], createdAt: 7 }, 'Cup');
  });

  it('starts the first season of a league with games and keeps those games in a season of their own', () => {
    const league: League = { name: 'Thursday', type: 'league', seasons: [], createdAt: 0 };
    games.set([
      makeGame({ gameId: 'a', league: 'Thursday', date: day('2025-09-04') + 72000000 }),
      makeGame({ gameId: 'b', league: 'Thursday', date: day('2025-10-02') + 72000000 }),
      makeGame({ gameId: 'c', league: 'Sunday', date: day('2025-10-05') }),
    ]);
    create(league, true);

    const [current, previous] = component.seasons();
    expect(previous).toMatchObject({ name: '2025/26', start: '2025-09-04' });
    expect(current.start).toBe(toDateInput(Date.now()));
    expect(component.seasonGameCounts()[previous.id]).toBe(2);
    expect(component.seasonGameCounts()[current.id]).toBe(0);
  });

  it('edits season names and dates', async () => {
    const league: League = { name: 'Thursday', type: 'league', seasons: [{ id: 's', name: '2026/27', start: day('2026-09-03') }], createdAt: 0 };
    leagueList.set([league]);
    create(league);

    component.setSeason('s', 'name', input('Fall'));
    component.setSeason('s', 'start', input('2026-09-10'));
    await component.save();

    expect(appFacade.updateLeague.mock.calls[0][0].seasons).toEqual([{ id: 's', name: 'Fall', start: day('2026-09-10') }]);
  });
});
