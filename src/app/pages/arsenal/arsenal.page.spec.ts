import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArsenalPage } from './arsenal.page';

describe('ArsenalPage', () => {
  let component: ArsenalPage;
  let fixture: ComponentFixture<ArsenalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ArsenalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
