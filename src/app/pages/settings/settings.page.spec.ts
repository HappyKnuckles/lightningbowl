import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SettingsStore } from 'src/app/core/stores/settings.store';

import { SettingsPage } from './settings.page';

const mockSettingsStore = {
  pinInputMode: vi.fn().mockReturnValue(true),
  savePinInputMode: vi.fn(),
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
