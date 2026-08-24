import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { BallDetailStats, BallStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { BallStatsComponent } from './ball-stats.component';

function makeDetail(overrides: Partial<BallDetailStats> = {}): BallDetailStats {
  return {
    throws: 40,
    firstBalls: 30,
    spareBalls: 10,
    throwShare: 60,
    strikes: 15,
    strikePercentage: 50,
    pocketHits: 24,
    pocketPercentage: 80,
    carryPercentage: 62.5,
    firstBallAverage: 8.4,
    splits: 2,
    splitPercentage: 6.7,
    openFrames: 4,
    openFramePercentage: 13.3,
    longestStrikeStreak: 4,
    cornerPinLeaves: 5,
    cornerPinPercentage: 16.7,
    flatCornerLeaves: 1,
    flatCornerPercentage: 3.3,
    solidLeaves: 3,
    solidPercentage: 10,
    washouts: 0,
    washoutPercentage: 0,
    lightLeaves: 4,
    lightPercentage: 13.3,
    highLeaves: 2,
    highPercentage: 6.7,
    spareAttempts: 10,
    sparesConverted: 8,
    spareConversionPercentage: 80,
    singlePinAttempts: 6,
    singlePinConverted: 6,
    singlePinPercentage: 100,
    multiPinAttempts: 4,
    multiPinConverted: 2,
    multiPinPercentage: 50,
    splitAttempts: 2,
    splitConverted: 0,
    splitConversionPercentage: 0,
    makeableSplitAttempts: 1,
    makeableSplitConverted: 0,
    makeableSplitPercentage: 0,
    averageMissMargin: 1.5,
    framesLed: 30,
    averageFrameValue: 18.5,
    projectedAverage: 185,
    marks: 23,
    markPercentage: 76.7,
    pinConversions: [{ pin: 10, occurrences: 6, pickups: 4, pickupPercentage: 66.7 }],
    leaves: [{ pins: [10], occurrences: 6, pickups: 4, pickupPercentage: 66.7 }],
    patternBreakdown: [{ pattern: 'Chameleon', firstBalls: 30, strikePercentage: 50, carryPercentage: 62.5, averageFrameValue: 18.5 }],
    ...overrides,
  };
}

function makeBallStats(overrides: Partial<BallStats> = {}): BallStats {
  return {
    key: 'IQ Tour15',
    name: 'IQ Tour',
    displayName: 'IQ Tour 15lbs',
    weight: '15',
    image: '',
    tier: 'basic',
    gameCount: 5,
    detailedGameCount: 0,
    avg: 180,
    highestGame: 220,
    lowestGame: 150,
    cleanGameCount: 2,
    lastUsed: 0,
    ...overrides,
  };
}

describe('BallStatsComponent', () => {
  let fixture: ComponentFixture<BallStatsComponent>;
  let component: BallStatsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BallStatsComponent],
      providers: [{ provide: BallsStore, useValue: { url: '', arsenal: signal<Ball[]>([]), allBalls: signal<Ball[]>([]) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(BallStatsComponent);
    component = fixture.componentInstance;
  });

  function setStats(stats: BallStats[]): void {
    fixture.componentRef.setInput('ballStats', stats);
    fixture.detectChanges();
  }

  it('should create', () => {
    setStats([]);
    expect(component).toBeTruthy();
  });

  it('shows only game-level numbers for a ball that was never tracked per throw', () => {
    setStats([makeBallStats()]);

    expect(component.rows()[0].metrics).toEqual([
      { label: 'Avg', value: '180' },
      { label: 'High', value: '220' },
      { label: 'Low', value: '150' },
    ]);
  });

  it('keeps the all-games average alongside the per-throw numbers', () => {
    setStats([makeBallStats({ tier: 'detailed', detail: makeDetail(), detailedGameCount: 3 })]);

    // The average covers all 5 games; the projection covers only the 3 tracked per throw.
    expect(component.rows()[0].metrics).toEqual([
      { label: 'Avg', value: '180' },
      { label: 'Proj. avg', value: '185' },
      { label: 'Strike', value: '50%' },
      { label: 'Carry', value: '62.5%' },
    ]);
  });

  it('says how much of a mixed ball’s history carries throw detail', () => {
    setStats([makeBallStats({ gameCount: 20, tier: 'detailed', detail: makeDetail(), detailedGameCount: 3 })]);

    expect(component.rows()[0].tierLabel).toBe('20 games · 3 by throw');
  });

  it('labels a ball with no throw detail by its games alone', () => {
    setStats([makeBallStats({ gameCount: 5 }), makeBallStats({ key: 'b2', gameCount: 1 })]);

    expect(component.rows()[0].tierLabel).toBe('5 games');
    expect(component.rows()[1].tierLabel).toBe('1 game');
  });

  it('warns in the label when a detailed ball rests on too few first balls', () => {
    setStats([makeBallStats({ tier: 'detailed', detail: makeDetail({ firstBalls: 4 }), detailedGameCount: 5 })]);

    expect(component.rows()[0].tierLabel).toBe('5 games · 5 by throw');
  });

  it('keeps a thin sample readable rather than dimming the whole card', () => {
    setStats([makeBallStats({ tier: 'detailed', detail: makeDetail({ firstBalls: 4 }) })]);

    // Every metric still carries a real value; the caveat lives in the label alone.
    expect(component.rows()[0].metrics.every((metric) => metric.value !== '')).toBe(true);
  });

  it('does not open the detail view for a basic ball', () => {
    setStats([makeBallStats()]);

    component.openDetail(component.rows()[0]);

    expect(component.selected()).toBeUndefined();
  });

  it('opens the detail view for a detailed ball', () => {
    setStats([makeBallStats({ tier: 'detailed', detail: makeDetail() })]);

    component.openDetail(component.rows()[0]);

    expect(component.selected()?.key).toBe('IQ Tour15');
    expect(component.pinConversions()).toHaveLength(1);
  });

  it('hides pattern rows that have too few first balls to mean anything', () => {
    const detail = makeDetail({
      patternBreakdown: [
        { pattern: 'Chameleon', firstBalls: 30, strikePercentage: 50, carryPercentage: 60, averageFrameValue: 18 },
        { pattern: 'Scorpion', firstBalls: 2, strikePercentage: 100, carryPercentage: 100, averageFrameValue: 30 },
      ],
    });
    setStats([makeBallStats({ tier: 'detailed', detail })]);
    component.openDetail(component.rows()[0]);

    expect(component.patternRows().map((row) => row.pattern)).toEqual(['Chameleon']);
  });
});
