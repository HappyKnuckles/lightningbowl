import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';

import { AlleySelectComponent } from './alley-select.component';
import { Alley } from 'src/app/core/models/alley.model';
import { AlleyFavoritesService } from 'src/app/core/services/alley/alley-favorites.service';
import { AlleyService } from 'src/app/core/services/alley/alley.service';

function makeAlley(overrides: Partial<Alley> = {}): Alley {
  return { id: 'node/1', name: 'Test Lanes', lat: 0, lon: 0, ...overrides };
}

const favorites = signal<Map<string, Alley>>(new Map());
const recents = signal<Alley[]>([]);

const mockFavoritesService = {
  favorites,
  recents,
  addRecent: vi.fn(),
  toggleFavorite: vi.fn(),
};

const mockAlleyService = {
  searchByText: vi.fn().mockResolvedValue([]),
  searchNearby: vi.fn().mockResolvedValue([]),
};

const mockModalCtrl = {
  dismiss: vi.fn().mockResolvedValue(true),
};

describe('AlleySelectComponent', () => {
  let component: AlleySelectComponent;
  let fixture: ComponentFixture<AlleySelectComponent>;

  beforeEach(async () => {
    favorites.set(new Map());
    recents.set([]);
    vi.clearAllMocks();
    mockAlleyService.searchByText.mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [AlleySelectComponent],
      providers: [
        { provide: AlleyFavoritesService, useValue: mockFavoritesService },
        { provide: AlleyService, useValue: mockAlleyService },
        { provide: ModalController, useValue: mockModalCtrl },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlleySelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists favorites as saved alleys and hides them from the recents list', () => {
    const favorite = makeAlley({ id: 'node/1', name: 'Favorite Lanes' });
    favorites.set(new Map([[favorite.id, favorite]]));
    recents.set([favorite, makeAlley({ id: 'node/2', name: 'Other Lanes' })]);

    expect(component.savedAlleys()).toEqual([favorite]);
    expect(component.recentAlleys().map((alley) => alley.id)).toEqual(['node/2']);
  });

  it('searches by text and shows the results instead of the saved lists', async () => {
    const found = makeAlley({ id: 'google/abc', name: 'Google Lanes', source: 'google' });
    mockAlleyService.searchByText.mockResolvedValue([found]);
    component.searchTerm.set('google lanes');

    await component.search();

    expect(mockAlleyService.searchByText).toHaveBeenCalledWith('google lanes');
    expect(component.results()).toEqual([found]);
    expect(component.showSavedLists()).toBe(false);
    expect(component.showCustomEntry()).toBe(false);
  });

  it('offers the typed term when neither source returns anything', async () => {
    component.searchTerm.set('unmapped alley');

    await component.search();

    expect(component.showCustomEntry()).toBe(true);

    await component.selectCustom();
    expect(mockModalCtrl.dismiss).toHaveBeenCalledWith('unmapped alley', 'select');
  });

  it('dismisses with the alley name and remembers the pick', async () => {
    const alley = makeAlley({ name: 'Strike Zone' });

    await component.select(alley);

    expect(mockFavoritesService.addRecent).toHaveBeenCalledWith(alley);
    expect(mockModalCtrl.dismiss).toHaveBeenCalledWith('Strike Zone', 'select');
  });

  it('dismisses with an empty name when the alley is cleared', async () => {
    await component.clear();

    expect(mockModalCtrl.dismiss).toHaveBeenCalledWith('', 'select');
  });

  it('dismisses with the cancel role when closed without a pick', async () => {
    await component.cancel();

    expect(mockModalCtrl.dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
