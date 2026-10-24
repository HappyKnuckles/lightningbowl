import { TestBed } from '@angular/core/testing';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { makeFrame, makeFrames, makeGame, makeThrow } from 'src/testing/fixtures';
import { BallDetailStatsCalculatorService } from './ball-detail-stats-calculator.service';

const IQ: ThrowBall = { name: 'IQ Tour', weight: '15' };
const PHAZE: ThrowBall = { name: 'Phaze II', weight: '15' };
const SPARE_BALL: ThrowBall = { name: 'White Dot', weight: '15' };

/** A per-throw tracked game whose frames are supplied directly. */
function detailedGame(frames: Game['frames'], overrides: Partial<Game> = {}): Game {
  const all = makeFrames();
  for (const frame of frames) {
    all[frame.frameIndex] = frame;
  }
  return makeGame({ frames: all, isPinMode: true, ballTracking: 'throw', ...overrides });
}

describe('BallDetailStatsCalculatorService', () => {
  let service: BallDetailStatsCalculatorService;
  let settingsStore: SettingsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BallDetailStatsCalculatorService, SettingsStore, BallsStore],
    });
    service = TestBed.inject(BallDetailStatsCalculatorService);
    settingsStore = TestBed.inject(SettingsStore);
    settingsStore.handedness.set('right');
  });

  it('skips games that are not tracked per throw', () => {
    const game = makeGame({
      ballTracking: 'game',
      balls: ['IQ Tour15'],
      frames: [makeFrame(0, [makeThrow(0, [], { ball: IQ })]), ...makeFrames().slice(1)],
    });

    expect(service.calculate([game]).size).toBe(0);
  });

  it('counts strikes against first balls only, not every throw', () => {
    // Frame 1: strike. Frame 2: gutter then all ten, which is a spare, not a strike.
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [], { ball: IQ })]),
      makeFrame(1, [
        makeThrow(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { ball: IQ }),
        makeThrow(1, [], { ball: IQ, available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
      ]),
    ]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.throws).toBe(3);
    expect(detail.firstBalls).toBe(2);
    expect(detail.spareBalls).toBe(1);
    expect(detail.strikes).toBe(1);
    expect(detail.strikePercentage).toBe(50);
  });

  it('separates carry from accuracy', () => {
    // Three pocket hits, one of which carried.
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [], { ball: IQ })]),
      makeFrame(1, [makeThrow(0, [10], { ball: IQ })]),
      makeFrame(2, [makeThrow(0, [10], { ball: IQ })]),
    ]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.pocketHits).toBe(3);
    expect(detail.pocketPercentage).toBe(100);
    expect(detail.strikePercentage).toBeCloseTo(33.3, 1);
    expect(detail.carryPercentage).toBeCloseTo(33.3, 1);
  });

  it('attributes first balls and spare balls to different balls in the same frame', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [], { ball: SPARE_BALL, available: [10] })]),
      makeFrame(1, [makeThrow(0, [7], { ball: IQ }), makeThrow(1, [7], { ball: SPARE_BALL, available: [7] })]),
    ]);

    const stats = service.calculate([game]);
    const strike = stats.get('IQ Tour15')!;
    const spare = stats.get('White Dot15')!;

    expect(strike.firstBalls).toBe(2);
    expect(strike.spareAttempts).toBe(0);
    expect(spare.firstBalls).toBe(0);
    expect(spare.spareAttempts).toBe(2);
    expect(spare.sparesConverted).toBe(1);
    expect(spare.spareConversionPercentage).toBe(50);
    expect(spare.singlePinAttempts).toBe(2);
    expect(spare.singlePinPercentage).toBe(50);
  });

  it('tracks conversion per single pin', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [], { ball: SPARE_BALL, available: [10] })]),
      makeFrame(1, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [10], { ball: SPARE_BALL, available: [10] })]),
      makeFrame(2, [makeThrow(0, [7], { ball: IQ }), makeThrow(1, [], { ball: SPARE_BALL, available: [7] })]),
    ]);

    const spare = service.calculate([game]).get('White Dot15')!;
    const tenPin = spare.pinConversions.find((entry) => entry.pin === 10)!;
    const sevenPin = spare.pinConversions.find((entry) => entry.pin === 7)!;

    expect(tenPin).toEqual({ pin: 10, occurrences: 2, pickups: 1, pickupPercentage: 50 });
    expect(sevenPin).toEqual({ pin: 7, occurrences: 1, pickups: 1, pickupPercentage: 100 });
  });

  it('records the miss margin of failed spare attempts', () => {
    const game = detailedGame([
      // 3-6-9-10 left, only the 3 falls: three pins still standing.
      makeFrame(0, [makeThrow(0, [3, 6, 9, 10], { ball: IQ }), makeThrow(1, [6, 9, 10], { ball: SPARE_BALL, available: [3, 6, 9, 10] })]),
    ]);

    const spare = service.calculate([game]).get('White Dot15')!;

    expect(spare.sparesConverted).toBe(0);
    expect(spare.averageMissMargin).toBe(3);
  });

  it('classifies the leaves a ball produces', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [10], { ball: IQ })]), // ringing corner
      makeFrame(1, [makeThrow(0, [6, 10], { ball: IQ })]), // flat corner
      makeFrame(2, [makeThrow(0, [2, 4, 5], { ball: IQ })]), // solid
      makeFrame(3, [makeThrow(0, [1, 2, 10], { ball: IQ })]), // washout
    ]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.cornerPinLeaves).toBe(1);
    expect(detail.flatCornerLeaves).toBe(1);
    expect(detail.solidLeaves).toBe(1);
    expect(detail.washouts).toBe(1);
    expect(detail.cornerPinPercentage).toBe(25);
  });

  it('mirrors the corner pin for a left-handed bowler', () => {
    settingsStore.handedness.set('left');
    const game = detailedGame([makeFrame(0, [makeThrow(0, [7], { ball: IQ })]), makeFrame(1, [makeThrow(0, [10], { ball: IQ })])]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.cornerPinLeaves).toBe(1);
  });

  it('attributes frame value and a projected average to the ball that led the frame', () => {
    // Frame 1 led by IQ scores 20, frame 2 led by Phaze scores 10.
    const game = detailedGame([makeFrame(0, [makeThrow(0, [], { ball: IQ })]), makeFrame(1, [makeThrow(0, [1, 2, 3, 4, 5], { ball: PHAZE })])], {
      frameScores: [20, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    });

    const stats = service.calculate([game]);

    expect(stats.get('IQ Tour15')!.averageFrameValue).toBe(20);
    expect(stats.get('IQ Tour15')!.projectedAverage).toBe(200);
    expect(stats.get('Phaze II15')!.averageFrameValue).toBe(10);
    expect(stats.get('Phaze II15')!.projectedAverage).toBe(100);
  });

  it('counts the tenth frame fresh racks as first balls', () => {
    const tenth = makeFrame(9, [makeThrow(0, [], { ball: IQ }), makeThrow(1, [], { ball: IQ }), makeThrow(2, [10], { ball: IQ })]);
    const detail = service.calculate([detailedGame([tenth])]).get('IQ Tour15')!;

    expect(detail.firstBalls).toBe(3);
    expect(detail.strikes).toBe(2);
  });

  it('treats every throw of a 10/10/10 tenth frame as a first ball', () => {
    const tenth = makeFrame(9, [makeThrow(0, [], { ball: IQ }), makeThrow(1, [], { ball: IQ }), makeThrow(2, [], { ball: IQ })]);

    const detail = service.calculate([detailedGame([tenth])]).get('IQ Tour15')!;

    expect(detail.firstBalls).toBe(3);
    expect(detail.strikes).toBe(3);
    expect(detail.spareAttempts).toBe(0);
  });

  it('reads a 9 / spare / strike tenth frame as first, spare, first', () => {
    const tenth = makeFrame(9, [
      makeThrow(0, [10], { ball: IQ }),
      makeThrow(1, [], { ball: SPARE_BALL, available: [10] }),
      makeThrow(2, [], { ball: IQ }),
    ]);

    const stats = service.calculate([detailedGame([tenth])]);

    expect(stats.get('IQ Tour15')!.firstBalls).toBe(2);
    expect(stats.get('IQ Tour15')!.strikes).toBe(1);
    expect(stats.get('White Dot15')!.spareAttempts).toBe(1);
    expect(stats.get('White Dot15')!.firstBalls).toBe(0);
  });

  it('treats the tenth frame second ball after an open first ball as a spare shot', () => {
    const tenth = makeFrame(9, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [], { ball: SPARE_BALL, available: [10] })]);
    const stats = service.calculate([detailedGame([tenth])]);

    expect(stats.get('IQ Tour15')!.firstBalls).toBe(1);
    expect(stats.get('White Dot15')!.spareAttempts).toBe(1);
    expect(stats.get('White Dot15')!.sparesConverted).toBe(1);
  });

  it('counts a leave pickup against the ball that produced the leave', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [], { ball: SPARE_BALL, available: [10] })]),
      makeFrame(1, [makeThrow(0, [10], { ball: IQ }), makeThrow(1, [10], { ball: SPARE_BALL, available: [10] })]),
    ]);

    const leave = service
      .calculate([game])
      .get('IQ Tour15')!
      .leaves.find((entry) => entry.pins.join() === '10')!;

    expect(leave.occurrences).toBe(2);
    expect(leave.pickups).toBe(1);
    expect(leave.pickupPercentage).toBe(50);
  });

  it('does not read a throw with no pin data as a pocket hit', () => {
    // A game typed on the classic grid still carries balls, so it reaches this calculator —
    // but it never recorded a pin, and an unset pinsLeftStanding is not a swept rack.
    const game = detailedGame([makeFrame(0, [{ value: 9, throwIndex: 1, ball: IQ }]), makeFrame(1, [{ value: 9, throwIndex: 1, ball: IQ }])]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.firstBalls).toBe(2);
    expect(detail.pocketHits).toBe(0);
    expect(detail.carryPercentage).toBe(0);
  });

  it('splits first ball performance by oil pattern', () => {
    const games = [
      detailedGame([makeFrame(0, [makeThrow(0, [], { ball: IQ })])], { patterns: ['Chameleon'] }),
      detailedGame([makeFrame(0, [makeThrow(0, [10], { ball: IQ })])], { patterns: ['Scorpion'] }),
    ];

    const breakdown = service.calculate(games).get('IQ Tour15')!.patternBreakdown;

    expect(breakdown.find((row) => row.pattern === 'Chameleon')!.strikePercentage).toBe(100);
    expect(breakdown.find((row) => row.pattern === 'Scorpion')!.strikePercentage).toBe(0);
  });

  it('reports each ball as a share of all tracked throws', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [], { ball: IQ })]),
      makeFrame(1, [makeThrow(0, [], { ball: IQ })]),
      makeFrame(2, [makeThrow(0, [], { ball: PHAZE })]),
      makeFrame(3, [makeThrow(0, [], { ball: PHAZE })]),
    ]);

    const stats = service.calculate([game]);

    expect(stats.get('IQ Tour15')!.throwShare).toBe(50);
    expect(stats.get('Phaze II15')!.throwShare).toBe(50);
  });

  it('does not let a different ball break a strike streak', () => {
    const game = detailedGame([
      makeFrame(0, [makeThrow(0, [], { ball: IQ })]),
      makeFrame(1, [makeThrow(0, [1, 2, 3, 4, 5], { ball: PHAZE })]),
      makeFrame(2, [makeThrow(0, [], { ball: IQ })]),
    ]);

    expect(service.calculate([game]).get('IQ Tour15')!.longestStrikeStreak).toBe(2);
  });

  it('ignores throws with no ball recorded', () => {
    const game = detailedGame([makeFrame(0, [makeThrow(0, [], { ball: IQ })]), makeFrame(1, [makeThrow(0, [])])]);

    const detail = service.calculate([game]).get('IQ Tour15')!;

    expect(detail.firstBalls).toBe(1);
    expect(detail.throwShare).toBe(100);
  });
});
