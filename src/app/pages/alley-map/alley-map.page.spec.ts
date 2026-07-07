import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AlleyMapPage } from './alley-map.page';

describe('AlleyMapPage', () => {
  let component: AlleyMapPage;
  let fixture: ComponentFixture<AlleyMapPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlleyMapPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AlleyMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
