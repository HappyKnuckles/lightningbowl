import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { makeGame } from 'src/testing/fixtures';

import { AlleyDetailSheetComponent } from './alley-detail-sheet.component';
import { Alley } from 'src/app/core/models/alley.model';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { GamesStore } from 'src/app/core/stores/games.store';

const games = signal(
  [
    makeGame({ gameId: '1', alley: 'Strike Zone', totalScore: 200, date: Date.UTC(2026, 2, 10, 19) }),
    makeGame({ gameId: '2', alley: 'Strike Zone', totalScore: 160, date: Date.UTC(2026, 2, 10, 21) }),
    makeGame({ gameId: '3', alley: 'Dream Bowl', totalScore: 120, date: Date.UTC(2026, 1, 1) }),
  ].slice(),
);

const mockGamesStore = { games };
const mockFavoritesService = {
  favorites: signal<Map<string, Alley>>(new Map()),
  recents: signal<Alley[]>([]),
  toggleFavorite: vi.fn(),
};

function makeAlley(name: string): Alley {
  return { id: 'node/1', name, lat: 0, lon: 0 };
}

describe('AlleyDetailSheetComponent', () => {
  let component: AlleyDetailSheetComponent;
  let fixture: ComponentFixture<AlleyDetailSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlleyDetailSheetComponent],
      providers: [
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: AlleyFavoritesService, useValue: mockFavoritesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlleyDetailSheetComponent);
    component = fixture.componentInstance;
  });

  it('summarises what the player logged at this alley', () => {
    fixture.componentRef.setInput('alley', makeAlley('Strike Zone'));
    fixture.detectChanges();

    expect(component.playHistory()).toMatchObject({
      name: 'Strike Zone',
      gameCount: 2,
      visitCount: 1, // both games fall on the same day
      avg: 180,
      highestGame: 200,
    });
  });

  it('reports no history for an alley the player never played at', () => {
    fixture.componentRef.setInput('alley', makeAlley('Somewhere Else'));
    fixture.detectChanges();

    expect(component.playHistory()).toBeNull();
  });
});
