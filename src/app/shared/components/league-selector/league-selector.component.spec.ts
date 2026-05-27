import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppFacade } from '@stores/app.facade';
import { LeaguesStore } from '@stores/leagues.store';
import { LeagueSelectorComponent } from './league-selector.component';

const mockLeaguesStore = {
  leagues: jasmine.createSpy('leagues').and.returnValue([]),
  addLeague: jasmine.createSpy('addLeague').and.returnValue(Promise.resolve()),
};

const mockAppFacade = {
  editLeague: jasmine.createSpy('editLeague').and.returnValue(Promise.resolve()),
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
    component.isAddPage = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
