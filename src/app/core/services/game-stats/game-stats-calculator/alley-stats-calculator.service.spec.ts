import { TestBed } from '@angular/core/testing';
import { makeGame } from 'src/testing/fixtures';
import { Frame } from 'src/app/core/models/game.model';

import { AlleyStatsCalculatorService } from './alley-stats-calculator.service';

/** Ten frames of strikes minus the last, so a game has a known strike count. */
function framesWithStrikes(strikeCount: number): Frame[] {
  return Array.from({ length: 10 }, (_, frameIndex) => ({
    frameIndex,
    throws: frameIndex < strikeCount ? [{ value: 10, throwIndex: 0 }] : [{ value: 0, throwIndex: 0 }],
  }));
}

describe('AlleyStatsCalculatorService', () => {
  let service: AlleyStatsCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlleyStatsCalculatorService);
  });

  it('aggregates score stats per alley and ignores games without one', () => {
    const games = [
      makeGame({ gameId: '1', alley: 'Strike Zone', totalScore: 200, isClean: true }),
      makeGame({ gameId: '2', alley: 'Strike Zone', totalScore: 150 }),
      makeGame({ gameId: '3', alley: 'Dream Bowl', totalScore: 180 }),
      makeGame({ gameId: '4', totalScore: 220 }),
      makeGame({ gameId: '5', alley: '', totalScore: 100 }),
    ];

    const stats = service.calculateAllAlleyStats(games);

    expect(stats.map((stat) => stat.name).sort()).toEqual(['Dream Bowl', 'Strike Zone']);
    const strikeZone = stats.find((stat) => stat.name === 'Strike Zone')!;
    expect(strikeZone).toMatchObject({
      gameCount: 2,
      avg: 175,
      highestGame: 200,
      lowestGame: 150,
      cleanGameCount: 1,
      cleanRate: 50,
      image: '',
    });
  });

  it('reports the strike rate over all twelve chances per game', () => {
    const games = [makeGame({ alley: 'Strike Zone', totalScore: 200, frames: framesWithStrikes(6) })];

    expect(service.calculateAllAlleyStats(games)[0].strikeRate).toBe(50);
  });

  it('picks the best alley by average and the most played by game count', () => {
    const games = [
      makeGame({ gameId: '1', alley: 'Busy Lanes', totalScore: 150 }),
      makeGame({ gameId: '2', alley: 'Busy Lanes', totalScore: 160 }),
      makeGame({ gameId: '3', alley: 'Busy Lanes', totalScore: 140 }),
      makeGame({ gameId: '4', alley: 'Rare Lanes', totalScore: 240 }),
    ];

    expect(service.calculateBestAlleyStats(games).name).toBe('Rare Lanes');
    expect(service.calculateMostPlayedAlleyStats(games).name).toBe('Busy Lanes');
  });

  it('reports the differential against the average of every game in the set', () => {
    const games = [
      makeGame({ gameId: '1', alley: 'Strike Zone', totalScore: 200 }),
      makeGame({ gameId: '2', alley: 'Dream Bowl', totalScore: 140 }),
      makeGame({ gameId: '3', totalScore: 140 }), // no alley, still part of the baseline
    ];

    const stats = service.calculateAllAlleyStats(games);

    // Baseline average is 160 across all three games.
    expect(stats.find((stat) => stat.name === 'Strike Zone')!.differential).toBe(40);
    expect(stats.find((stat) => stat.name === 'Dream Bowl')!.differential).toBe(-20);
  });

  it('counts games on the same day as one visit and tracks the last one played', () => {
    const morning = Date.UTC(2026, 2, 10, 9);
    const evening = Date.UTC(2026, 2, 10, 20);
    const nextWeek = Date.UTC(2026, 2, 17, 19);
    const games = [
      makeGame({ gameId: '1', alley: 'Strike Zone', date: morning, totalScore: 150 }),
      makeGame({ gameId: '2', alley: 'Strike Zone', date: evening, totalScore: 170 }),
      makeGame({ gameId: '3', alley: 'Strike Zone', date: nextWeek, totalScore: 160 }),
    ];

    const strikeZone = service.calculateAllAlleyStats(games)[0];

    expect(strikeZone.gameCount).toBe(3);
    expect(strikeZone.visitCount).toBe(2);
    expect(strikeZone.lastPlayed).toBe(nextWeek);
  });

  it('returns an empty highlight when no game names an alley', () => {
    const stats = service.calculateBestAlleyStats([makeGame({ totalScore: 200 })]);

    expect(stats.name).toBe('');
    expect(stats.gameCount).toBe(0);
  });
});
