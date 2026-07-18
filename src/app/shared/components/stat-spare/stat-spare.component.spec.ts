import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { StatSpareComponent } from './stat-spare.component';

describe('SpareDisplayComponent', () => {
  let component: StatSpareComponent;
  let fixture: ComponentFixture<StatSpareComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [StatSpareComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatSpareComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('stats', {
      totalGames: 0,
      totalPins: 0,
      perfectGameCount: 0,
      cleanGameCount: 0,
      cleanGamePercentage: 0,
      totalStrikes: 0,
      totalSpares: 0,
      totalSparesMissed: 0,
      totalSparesConverted: 0,
      pinCounts: Array(11).fill(0),
      missedCounts: Array(11).fill(0),
      averageStrikesPerGame: 0,
      averageSparesPerGame: 0,
      averageOpensPerGame: 0,
      strikePercentage: 0,
      sparePercentage: 0,
      openPercentage: 0,
      averageFirstCount: 0,
      averageScore: 0,
      highGame: 0,
      lowGame: 0,
      spareRates: [],
      overallSpareRate: 0,
      overallMissedRate: 0,
    });
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
