import { Injectable, inject } from '@angular/core';
import { Frame, Game, Throw, ThrowBall } from 'src/app/core/models/game.model';
import { BallDetailStats, BallPatternStats, LeaveStats, PinConversionStats } from 'src/app/core/models/stats.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { SettingsStore } from 'src/app/core/stores/settings.store';
import { formatThrowBall, getBallTracking, getThrowBallKey } from 'src/app/core/utils/game-utils/ball.utils';
import {
  isCornerPinLeave,
  isFlatCornerLeave,
  isHighLeave,
  isLightLeave,
  isMakeableSplit,
  isPocketHit,
  isSolidLeave,
  isSplit,
  isWashout,
} from 'src/app/core/utils/game-utils/pin.utils';

/** What a throw was for. A ball is judged very differently as a first ball than as a spare ball. */
type ThrowRole = 'first' | 'spare';

interface RoledThrow {
  /**
   * Whether the throw recorded pin data at all. A throw typed on the classic grid, or imported
   * from a sheet that has no pin columns, leaves `pinsLeftStanding` unset — which reads as an
   * empty rack, i.e. a pocket hit, unless the two are told apart here.
   */
  hasPinData: boolean;
  /** First balls only: whether the leave this throw produced was picked up afterwards. */
  leaveConverted?: boolean;
  /** Pins still standing after it. */
  pinsAfter: number[];
  /** Pins standing when the throw was made. Empty for a first ball on a full rack. */
  pinsBefore: number[];
  role: ThrowRole;
  throwData: Throw;
}

/** Everything accumulated for one ball before it is turned into rates. */
interface BallAccumulator {
  key: string;
  ball: ThrowBall;
  throws: number;
  firstBalls: number;
  spareBalls: number;

  strikes: number;
  pocketHits: number;
  firstBallPins: number;
  splits: number;
  strikeStreak: number;
  longestStrikeStreak: number;

  cornerPinLeaves: number;
  flatCornerLeaves: number;
  solidLeaves: number;
  washouts: number;
  lightLeaves: number;
  highLeaves: number;

  spareAttempts: number;
  sparesConverted: number;
  singlePinAttempts: number;
  singlePinConverted: number;
  multiPinAttempts: number;
  multiPinConverted: number;
  splitAttempts: number;
  splitConverted: number;
  makeableSplitAttempts: number;
  makeableSplitConverted: number;
  missMarginPins: number;
  missCount: number;

  framesLed: number;
  frameValue: number;
  frameValueSamples: number;
  marks: number;
  openFrames: number;

  pinConversions: Map<number, { occurrences: number; pickups: number }>;
  leaves: Map<string, { pins: number[]; occurrences: number; pickups: number }>;
  patterns: Map<string, { firstBalls: number; strikes: number; pocketHits: number; frameValue: number; framesLed: number }>;
}

@Injectable({ providedIn: 'root' })
export class BallDetailStatsCalculatorService {
  #ballsStore = inject(BallsStore);
  #settingsStore = inject(SettingsStore);

  /**
   * Per-throw stats for every ball in the given games, keyed by ball key.
   * Games without per-throw tracking are skipped entirely. They carry no throw-level
   * truth, and guessing one would quietly poison every rate below.
   */
  calculate(games: Game[]): Map<string, BallDetailStats> {
    const detailedGames = games.filter((game) => getBallTracking(game) === 'throw');
    const isLeft = this.#settingsStore.handedness() === 'left';
    const accumulators = new Map<string, BallAccumulator>();
    let totalTrackedThrows = 0;

    for (const game of detailedGames) {
      const patterns = game.patterns?.length ? game.patterns : ['No pattern'];

      game.frames.forEach((frame, frameIndex) => {
        if (frameIndex > 9) return;

        const leadBall = frame.throws?.[0]?.ball;
        const frameValue = this.frameValue(game, frameIndex);
        const outcome = this.frameOutcome(frame, frameIndex);

        if (leadBall?.name) {
          const acc = this.accumulatorFor(accumulators, leadBall);
          acc.framesLed++;
          if (frameValue !== undefined) {
            acc.frameValue += frameValue;
            acc.frameValueSamples++;
          }
          if (outcome === 'mark') acc.marks++;
          if (outcome === 'open') acc.openFrames++;

          for (const pattern of patterns) {
            const entry = this.patternEntry(acc, pattern);
            entry.framesLed++;
            if (frameValue !== undefined) entry.frameValue += frameValue;
          }
        }

        for (const roled of this.rolesForFrame(frame, frameIndex)) {
          const ball = roled.throwData.ball;
          if (!ball?.name) continue;

          totalTrackedThrows++;
          const acc = this.accumulatorFor(accumulators, ball);
          acc.throws++;

          if (roled.role === 'first') {
            this.recordFirstBall(acc, roled, isLeft, patterns);
          } else {
            this.recordSpareBall(acc, roled);
          }
        }
      });
    }

    const result = new Map<string, BallDetailStats>();
    for (const [key, acc] of accumulators) {
      result.set(key, this.finalize(acc, totalTrackedThrows));
    }
    return result;
  }

  // --- Throw roles ---

  /**
   * Splits a frame's throws into first balls and spare balls. The tenth frame can hand
   * out extra fresh racks, and each of those is a first ball in its own right.
   */
  private rolesForFrame(frame: Frame, frameIndex: number): RoledThrow[] {
    const throws = frame.throws ?? [];
    if (throws.length === 0) return [];

    const roles: RoledThrow[] = [];
    const first = throws[0];
    const second = throws[1];
    const third = throws[2];

    const firstConverted = second !== undefined && first.value !== 10 && first.value + second.value === 10;
    roles.push({
      role: 'first',
      throwData: first,
      pinsBefore: [],
      pinsAfter: first.pinsLeftStanding ?? [],
      hasPinData: first.pinsLeftStanding !== undefined,
      leaveConverted: firstConverted,
    });

    if (frameIndex < 9) {
      if (second && first.value !== 10) {
        roles.push({
          role: 'spare',
          throwData: second,
          pinsBefore: first.pinsLeftStanding ?? [],
          pinsAfter: second.pinsLeftStanding ?? [],
          hasPinData: second.pinsLeftStanding !== undefined,
        });
      }
      return roles;
    }

    if (second) {
      const freshRack = first.value === 10;
      roles.push({
        role: freshRack ? 'first' : 'spare',
        throwData: second,
        pinsBefore: freshRack ? [] : (first.pinsLeftStanding ?? []),
        pinsAfter: second.pinsLeftStanding ?? [],
        hasPinData: second.pinsLeftStanding !== undefined,
        leaveConverted: freshRack && third !== undefined && second.value !== 10 && second.value + third.value === 10,
      });
    }

    if (third && second) {
      const afterDouble = first.value === 10 && second.value === 10;
      const afterSpare = first.value !== 10 && first.value + second.value === 10;
      if (afterDouble || afterSpare) {
        roles.push({
          role: 'first',
          throwData: third,
          pinsBefore: [],
          pinsAfter: third.pinsLeftStanding ?? [],
          hasPinData: third.pinsLeftStanding !== undefined,
        });
      } else if (first.value === 10) {
        roles.push({
          role: 'spare',
          throwData: third,
          pinsBefore: second.pinsLeftStanding ?? [],
          pinsAfter: third.pinsLeftStanding ?? [],
          hasPinData: third.pinsLeftStanding !== undefined,
        });
      }
    }

    return roles;
  }

  // --- Recording ---

  private recordFirstBall(acc: BallAccumulator, roled: RoledThrow, isLeft: boolean, patterns: string[]): void {
    const { throwData, pinsAfter } = roled;
    acc.firstBalls++;
    acc.firstBallPins += throwData.value;

    const isStrike = throwData.value === 10;
    if (isStrike) {
      acc.strikes++;
      acc.strikeStreak++;
      acc.longestStrikeStreak = Math.max(acc.longestStrikeStreak, acc.strikeStreak);
    } else {
      acc.strikeStreak = 0;
    }

    const pocketHit = roled.hasPinData && isPocketHit(pinsAfter);
    if (pocketHit) acc.pocketHits++;

    for (const pattern of patterns) {
      const entry = this.patternEntry(acc, pattern);
      entry.firstBalls++;
      if (isStrike) entry.strikes++;
      if (pocketHit) entry.pocketHits++;
    }

    if (!roled.hasPinData || isStrike || pinsAfter.length === 0) return;

    if (isSplit(pinsAfter)) acc.splits++;
    if (isCornerPinLeave(pinsAfter, isLeft)) acc.cornerPinLeaves++;
    if (isFlatCornerLeave(pinsAfter, isLeft)) acc.flatCornerLeaves++;
    if (isSolidLeave(pinsAfter, isLeft)) acc.solidLeaves++;
    if (isWashout(pinsAfter)) acc.washouts++;
    if (isLightLeave(pinsAfter, isLeft)) acc.lightLeaves++;
    if (isHighLeave(pinsAfter, isLeft)) acc.highLeaves++;

    const sorted = [...pinsAfter].sort((a, b) => a - b);
    const key = sorted.join(',');
    const leave = acc.leaves.get(key) ?? { pins: sorted, occurrences: 0, pickups: 0 };
    leave.occurrences++;
    if (roled.leaveConverted) leave.pickups++;
    acc.leaves.set(key, leave);
  }

  private recordSpareBall(acc: BallAccumulator, roled: RoledThrow): void {
    const { throwData, pinsBefore, pinsAfter } = roled;
    acc.spareBalls++;

    if (pinsBefore.length === 0) return;

    const converted = pinsAfter.length === 0 && throwData.value === pinsBefore.length;
    acc.spareAttempts++;
    if (converted) acc.sparesConverted++;
    else {
      acc.missCount++;
      acc.missMarginPins += pinsAfter.length;
    }

    if (pinsBefore.length === 1) {
      acc.singlePinAttempts++;
      if (converted) acc.singlePinConverted++;

      const pin = pinsBefore[0];
      const entry = acc.pinConversions.get(pin) ?? { occurrences: 0, pickups: 0 };
      entry.occurrences++;
      if (converted) entry.pickups++;
      acc.pinConversions.set(pin, entry);
    } else {
      acc.multiPinAttempts++;
      if (converted) acc.multiPinConverted++;
    }

    if (isSplit(pinsBefore)) {
      acc.splitAttempts++;
      if (converted) acc.splitConverted++;
      if (isMakeableSplit(pinsBefore)) {
        acc.makeableSplitAttempts++;
        if (converted) acc.makeableSplitConverted++;
      }
    }
  }

  // --- Frame helpers ---

  /** Scored value of a frame, bonuses included, from the running frame scores. */
  private frameValue(game: Game, frameIndex: number): number | undefined {
    const scores = game.frameScores ?? [];
    const current = scores[frameIndex];
    if (!Number.isFinite(current)) return undefined;
    const previous = frameIndex === 0 ? 0 : scores[frameIndex - 1];
    if (!Number.isFinite(previous)) return undefined;
    return current - previous;
  }

  private frameOutcome(frame: Frame, frameIndex: number): 'mark' | 'open' | 'incomplete' {
    const throws = frame.throws ?? [];
    const first = throws[0]?.value;
    if (first === undefined) return 'incomplete';
    if (first === 10) return 'mark';

    const second = throws[1]?.value;
    if (second === undefined) return 'incomplete';
    if (first + second === 10) return 'mark';

    // A tenth frame that opens on the first two balls is still an open frame.
    return frameIndex === 9 && throws.length < 2 ? 'incomplete' : 'open';
  }

  // --- Accumulator plumbing ---

  private accumulatorFor(map: Map<string, BallAccumulator>, ball: ThrowBall): BallAccumulator {
    const key = getThrowBallKey(ball);
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        ball,
        throws: 0,
        firstBalls: 0,
        spareBalls: 0,
        strikes: 0,
        pocketHits: 0,
        firstBallPins: 0,
        splits: 0,
        strikeStreak: 0,
        longestStrikeStreak: 0,
        cornerPinLeaves: 0,
        flatCornerLeaves: 0,
        solidLeaves: 0,
        washouts: 0,
        lightLeaves: 0,
        highLeaves: 0,
        spareAttempts: 0,
        sparesConverted: 0,
        singlePinAttempts: 0,
        singlePinConverted: 0,
        multiPinAttempts: 0,
        multiPinConverted: 0,
        splitAttempts: 0,
        splitConverted: 0,
        makeableSplitAttempts: 0,
        makeableSplitConverted: 0,
        missMarginPins: 0,
        missCount: 0,
        framesLed: 0,
        frameValue: 0,
        frameValueSamples: 0,
        marks: 0,
        openFrames: 0,
        pinConversions: new Map(),
        leaves: new Map(),
        patterns: new Map(),
      };
      map.set(key, acc);
    }
    return acc;
  }

  private patternEntry(acc: BallAccumulator, pattern: string) {
    let entry = acc.patterns.get(pattern);
    if (!entry) {
      entry = { firstBalls: 0, strikes: 0, pocketHits: 0, frameValue: 0, framesLed: 0 };
      acc.patterns.set(pattern, entry);
    }
    return entry;
  }

  // --- Finalizing ---

  private finalize(acc: BallAccumulator, totalTrackedThrows: number): BallDetailStats {
    const averageFrameValue = this.rate(acc.frameValue, acc.frameValueSamples, 1);

    const leaves: LeaveStats[] = [...acc.leaves.values()]
      .map((leave) => ({
        ...leave,
        pickupPercentage: this.percentage(leave.pickups, leave.occurrences),
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    const pinConversions: PinConversionStats[] = [...acc.pinConversions.entries()]
      .map(([pin, entry]) => ({
        pin,
        occurrences: entry.occurrences,
        pickups: entry.pickups,
        pickupPercentage: this.percentage(entry.pickups, entry.occurrences),
      }))
      .sort((a, b) => a.pin - b.pin);

    const patternBreakdown: BallPatternStats[] = [...acc.patterns.entries()]
      .map(([pattern, entry]) => ({
        pattern,
        firstBalls: entry.firstBalls,
        strikePercentage: this.percentage(entry.strikes, entry.firstBalls),
        carryPercentage: this.percentage(entry.strikes, entry.pocketHits),
        averageFrameValue: this.rate(entry.frameValue, entry.framesLed, 1),
      }))
      .sort((a, b) => b.firstBalls - a.firstBalls);

    return {
      throws: acc.throws,
      firstBalls: acc.firstBalls,
      spareBalls: acc.spareBalls,
      throwShare: this.percentage(acc.throws, totalTrackedThrows),

      strikes: acc.strikes,
      strikePercentage: this.percentage(acc.strikes, acc.firstBalls),
      pocketHits: acc.pocketHits,
      pocketPercentage: this.percentage(acc.pocketHits, acc.firstBalls),
      carryPercentage: this.percentage(acc.strikes, acc.pocketHits),
      firstBallAverage: this.rate(acc.firstBallPins, acc.firstBalls, 2),
      splits: acc.splits,
      splitPercentage: this.percentage(acc.splits, acc.firstBalls),
      openFrames: acc.openFrames,
      openFramePercentage: this.percentage(acc.openFrames, acc.framesLed),
      longestStrikeStreak: acc.longestStrikeStreak,

      cornerPinLeaves: acc.cornerPinLeaves,
      cornerPinPercentage: this.percentage(acc.cornerPinLeaves, acc.firstBalls),
      flatCornerLeaves: acc.flatCornerLeaves,
      flatCornerPercentage: this.percentage(acc.flatCornerLeaves, acc.firstBalls),
      solidLeaves: acc.solidLeaves,
      solidPercentage: this.percentage(acc.solidLeaves, acc.firstBalls),
      washouts: acc.washouts,
      washoutPercentage: this.percentage(acc.washouts, acc.firstBalls),
      lightLeaves: acc.lightLeaves,
      lightPercentage: this.percentage(acc.lightLeaves, acc.firstBalls),
      highLeaves: acc.highLeaves,
      highPercentage: this.percentage(acc.highLeaves, acc.firstBalls),

      spareAttempts: acc.spareAttempts,
      sparesConverted: acc.sparesConverted,
      spareConversionPercentage: this.percentage(acc.sparesConverted, acc.spareAttempts),
      singlePinAttempts: acc.singlePinAttempts,
      singlePinConverted: acc.singlePinConverted,
      singlePinPercentage: this.percentage(acc.singlePinConverted, acc.singlePinAttempts),
      multiPinAttempts: acc.multiPinAttempts,
      multiPinConverted: acc.multiPinConverted,
      multiPinPercentage: this.percentage(acc.multiPinConverted, acc.multiPinAttempts),
      splitAttempts: acc.splitAttempts,
      splitConverted: acc.splitConverted,
      splitConversionPercentage: this.percentage(acc.splitConverted, acc.splitAttempts),
      makeableSplitAttempts: acc.makeableSplitAttempts,
      makeableSplitConverted: acc.makeableSplitConverted,
      makeableSplitPercentage: this.percentage(acc.makeableSplitConverted, acc.makeableSplitAttempts),
      averageMissMargin: this.rate(acc.missMarginPins, acc.missCount, 2),

      framesLed: acc.framesLed,
      averageFrameValue,
      projectedAverage: Math.round(averageFrameValue * 10),
      marks: acc.marks,
      markPercentage: this.percentage(acc.marks, acc.framesLed),

      pinConversions,
      leaves,
      patternBreakdown,
    };
  }

  private percentage(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
  }

  private rate(total: number, count: number, decimals: number): number {
    if (count <= 0) return 0;
    const factor = 10 ** decimals;
    return Math.round((total / count) * factor) / factor;
  }

  /** Display name for a ball key, resolved against the arsenal where possible. */
  displayName(ball: ThrowBall): string {
    const arsenalBall = this.#ballsStore
      .arsenal()
      .find((b) => getThrowBallKey({ name: b.ball_name, weight: b.core_weight }) === getThrowBallKey(ball));
    return arsenalBall ? `${arsenalBall.ball_name} ${arsenalBall.core_weight}lbs` : formatThrowBall(ball);
  }
}
