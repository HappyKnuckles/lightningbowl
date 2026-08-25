import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AppFacade } from 'src/app/core/stores/app.facade';
import { LeaguesStore } from 'src/app/core/stores/leagues.store';

import { LeagueSelectorComponent } from './league-selector.component';

const mockLeaguesStore = {
  leagues: vi.fn().mockReturnValue([]),
  addLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

const mockAppFacade = {
  editLeague: vi.fn().mockReturnValue(Promise.resolve()),
};

describe('LeagueSelectorComponent', () => {
  let component: LeagueSelectorComponent;
  let fixture: ComponentFixture<LeagueSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeagueSelectorComponent],
      providers: [
        { provide: LeaguesStore, useValue: mockLeaguesStore },
        { provide: AppFacade, useValue: mockAppFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeagueSelectorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isAddPage', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
