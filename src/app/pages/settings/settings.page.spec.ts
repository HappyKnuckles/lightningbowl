import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsStore } from '@stores/settings.store';
import { SettingsPage } from './settings.page';

const mockSettingsStore = {
  pinInputMode: jasmine.createSpy('pinInputMode').and.returnValue(true),
  savePinInputMode: jasmine.createSpy('savePinInputMode'),
};

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [{ provide: SettingsStore, useValue: mockSettingsStore }],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
