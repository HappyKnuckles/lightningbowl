import { Injectable } from '@angular/core';

import { Frame, Game, Throw } from 'src/app/core/models/game.model';
import { SeriesStats, Stats } from 'src/app/core/models/stats.model';

import { isMakeableSplit, isSplit } from '../../../utils/game-utils/pin.utils';

const MAX_FRAMES = 10;

@Injectable({
  providedIn: 'root',
})
export class OverallStatsCalculatorService {
  calculateBowlingStats(gameHistory: Game[], seriesStats: SeriesStats): Stats {
    let totalStrikes = 0;
    let totalSparesConverted = 0;
    let totalSparesMissed = 0;
    const pinCounts = Array(11).fill(0);
    const missedCounts = Array(11).fill(0);
    let firstThrowCount = 0;
    let totalFirstThrowCount = 0;
    let perfectGameCount = 0;
    let cleanGameCount = 0;
    let longestStrikeStreak = 0;
    let currentStrikeStreak = 0;
    let longestOpenStreak = 0;
    let currentOpenStreak = 0;
    let dutch200Count = 0;
    let varipapa300Count = 0;
    let strikeoutCount = 0;
    let allSparesGameCount = 0;
    let pocketHits = 0;
    let totalFirstBalls = 0;
    let splits = 0;
    let splitOpportunities = 0;
    let makeableSplits = 0;
    let makeableSplitOpportunities = 0;
    let strikeFollowUps = 0;
    let strikeFollowUpsPossible = 0;
    let previousWasStrike = false;
    let highGame = 0;
    let lowGame = 300;
    let totalPins = 0;
    const distinctDays = new Set<string>();
    let minT: number | null = null;
    let maxT: number | null = null;
    let previousGameDate: string | null = null;

    // Streak counts for exactly n consecutive strikes (3 to 11)
    const streakCounts = Array(12).fill(0);
    const recordStrikeStreak = (len: number) => {
      if (len >= 3 && len <= 11) streakCounts[len]++;
    };

    // Pocket hit = head pin down AND at least one of the 2/3 pins down.
    // Empty array (a strike) returns true, which is correct.
    const isPocketHit = (pinsLeft: number[]): boolean => {
      const pin1Down = !pinsLeft.includes(1);
      const pin2Down = !pinsLeft.includes(2);
      const pin3Down = !pinsLeft.includes(3);
      return pin1Down && (pin2Down || pin3Down);
    };

    gameHistory.forEach((game) => {
      let strikesInThisGame = 0;
      let isAllSpares = true;
      let dutchOk = true;
      let patternStartsWithStrike = false;
      totalFirstThrowCount += game.frames.length;
      totalPins += game.totalScore;

      if (game.totalScore === 200) {
        const firstFrame = game.frames[0];
        const firstThrows = firstFrame.throws.map((t: Throw) => t.value);
        const firstIsStrike = firstThrows[0] === 10;
        const firstIsSpare = !firstIsStrike && firstThrows.length > 1 && firstThrows[0] + firstThrows[1] === 10;

        if (firstIsStrike) {
          patternStartsWithStrike = true;
        } else if (firstIsSpare) {
          patternStartsWithStrike = false;
        } else {
          dutchOk = false;
        }
      }

      const gameDate = new Date(game.date).toDateString();
      distinctDays.add(gameDate);
      const t = new Date(game.date).getTime();
      if (minT === null || t < minT) minT = t;
      if (maxT === null || t > maxT) maxT = t;

      if (game.totalScore > highGame) highGame = game.totalScore;
      if (game.totalScore < lowGame) lowGame = game.totalScore;
      if (game.isClean) cleanGameCount++;
      if (game.isPerfect) perfectGameCount++;

      if (gameDate !== previousGameDate) {
        recordStrikeStreak(currentStrikeStreak);
        longestOpenStreak = Math.max(longestOpenStreak, currentOpenStreak);
        currentStrikeStreak = 0;
        currentOpenStreak = 0;
        previousGameDate = gameDate;
        previousWasStrike = false;
      }

      game.frames.forEach((frame: Frame, idx: number) => {
        const throws = frame.throws.map((t: Throw) => t.value);
        firstThrowCount += throws[0] || 0;
        const throw1 = throws[0];
        const throw2 = throws.length > 1 ? throws[1] : undefined;
        const throw3 = throws.length > 2 ? throws[2] : undefined;

        const isStrike = throw1 === 10;
        const isSecondStrike = throw2 === 10;
        const isThirdStrike = throw3 === 10;
        const isStrikeOut = isStrike && isSecondStrike && isThirdStrike;
        const isSpare = !isStrike && throw2 !== undefined && throw1 + throw2 === 10;
        const isOpen = !isStrike && !isSpare;

        if (previousWasStrike) {
          strikeFollowUpsPossible++;
          if (isStrike) strikeFollowUps++;
        }
        previousWasStrike = isStrike;

        if (game.totalScore === 200) {
          const shouldBeStrike = patternStartsWithStrike ? idx % 2 === 0 : idx % 2 !== 0;
          if (idx < 9) {
            if (shouldBeStrike && !isStrike) {
              dutchOk = false;
            } else if (!shouldBeStrike && !isSpare) {
              dutchOk = false;
            }
          } else {
            const ninthFrameShouldHaveBeenStrike = patternStartsWithStrike ? 8 % 2 === 0 : 8 % 2 !== 0;

            if (ninthFrameShouldHaveBeenStrike) {
              if (!(isSpare && throws.length >= 3 && throws[2] === 10)) {
                dutchOk = false;
              }
            } else {
              const isFillBallSpare = throws.length >= 3 && throws[1] + throws[2] === 10;
              if (!(isStrike && isFillBallSpare)) {
                dutchOk = false;
              }
            }
          }
        }

        if (idx === MAX_FRAMES - 1 && isStrike) {
          if (throw2 !== undefined) {
            firstThrowCount += throw2;
            totalFirstThrowCount++;

            if (throw1 === 10) {
              strikeFollowUpsPossible++;
              if (throw2 === 10) strikeFollowUps++;
            }
          }

          if (throw3 !== undefined) {
            firstThrowCount += throw3;
            totalFirstThrowCount++;

            if (throw2 === 10) {
              strikeFollowUpsPossible++;
              if (throw3 === 10) strikeFollowUps++;
            }
          }
        }

        if (isStrike || !isSpare) isAllSpares = false;

        // Open streak
        if (isOpen) {
          currentOpenStreak++;
        } else {
          longestOpenStreak = Math.max(longestOpenStreak, currentOpenStreak);
          currentOpenStreak = 0;
        }

        // Pin counts
        if (isSpare) {
          pinCounts[10 - throw1]++;
        } else if (isOpen) {
          missedCounts[10 - throw1]++;
        }
        if (idx === MAX_FRAMES - 1 && isStrike && throw2 !== undefined && throw2 < 10) {
          if (throw3 !== undefined) {
            if (throw2 + throw3 === 10) pinCounts[10 - throw2]++;
            else if (throw2 + throw3 < 10) missedCounts[10 - throw2]++;
          } else {
            missedCounts[10 - throw2]++;
          }
        }

        // Strike streak
        if (isStrike) {
          totalStrikes++;
          currentStrikeStreak++;
          strikesInThisGame++;
          if (isSecondStrike) {
            totalStrikes++;
            currentStrikeStreak++;
            strikesInThisGame++;
          }
          if (isThirdStrike) {
            totalStrikes++;
            currentStrikeStreak++;
            strikesInThisGame++;
          }
          if (isStrikeOut) strikeoutCount++;
          if (currentStrikeStreak === 12 && strikesInThisGame < 12) varipapa300Count++;
        } else {
          recordStrikeStreak(currentStrikeStreak);
          currentStrikeStreak = 0;
          // Count strike on fill ball in 10th if previous was spare
          if (idx === MAX_FRAMES - 1 && isSpare && throw3 === 10) {
            totalStrikes++;
          }
        }
        longestStrikeStreak = Math.max(longestStrikeStreak, currentStrikeStreak);

        // Pocket hit tracking (only for pin mode games with pin data)
        if (game.isPinMode && frame.throws) {
          // Frames 1-9: the lead-off ball is the only fresh-rack ball
          if (frame.throws[0] && idx < 9) {
            totalFirstBalls++;
            if (frame.throws[0].pinsLeftStanding && isPocketHit(frame.throws[0].pinsLeftStanding)) {
              pocketHits++;
            }
          }

          // 10th frame: ball 1 is always fresh; ball 2 is fresh after a strike;
          // ball 3 is fresh after a double. Check the pocket on each fresh-rack ball.
          if (idx === 9) {
            totalFirstBalls++;
            if (frame.throws[0]?.pinsLeftStanding && isPocketHit(frame.throws[0].pinsLeftStanding)) {
              pocketHits++;
            }

            if (isStrike) {
              totalFirstBalls++;
              if (frame.throws[1]?.pinsLeftStanding && isPocketHit(frame.throws[1].pinsLeftStanding)) {
                pocketHits++;
              }
            }

            if (isSecondStrike) {
              totalFirstBalls++;
              if (frame.throws[2]?.pinsLeftStanding && isPocketHit(frame.throws[2].pinsLeftStanding)) {
                pocketHits++;
              }
            }
          }
        }

        // Split detection (only for pin mode games with pin data)
        if (!isStrike && game.isPinMode && frame.throws && frame.throws[0] && frame.throws[0].pinsLeftStanding) {
          const pinsLeft = frame.throws[0].pinsLeftStanding;
          if (pinsLeft.length > 1) {
            if (isSplit(pinsLeft)) {
              splitOpportunities++;
              if (isMakeableSplit(pinsLeft)) {
                makeableSplitOpportunities++;
              }
              if (isSpare) {
                splits++;
                if (isMakeableSplit(pinsLeft)) {
                  makeableSplits++;
                }
              }
            }
          }
        }

        // 10th frame fill ball split detection (only for pin mode games with pin data)
        if (
          idx === MAX_FRAMES - 1 &&
          isStrike &&
          throw2 !== undefined &&
          !isSecondStrike &&
          game.isPinMode &&
          frame.throws &&
          frame.throws[1] &&
          frame.throws[1].pinsLeftStanding
        ) {
          const pinsLeft = frame.throws[1].pinsLeftStanding;
          if (pinsLeft.length > 1) {
            if (isSplit(pinsLeft)) {
              splitOpportunities++;
              if (isMakeableSplit(pinsLeft)) {
                makeableSplitOpportunities++;
              }
              if (throw3 !== undefined && throw2 + throw3 === 10) {
                splits++;
                if (isMakeableSplit(pinsLeft)) {
                  makeableSplits++;
                }
              }
            }
          }
        }
      });

      if (isAllSpares) allSparesGameCount++;
      if (dutchOk && game.totalScore === 200) dutch200Count++;
    });

    // Finalize streaks
    recordStrikeStreak(currentStrikeStreak);
    longestOpenStreak = Math.max(longestOpenStreak, currentOpenStreak);

    // Compute spare totals
    for (let i = 1; i <= MAX_FRAMES; i++) {
      totalSparesMissed += missedCounts[i] || 0;
      totalSparesConverted += pinCounts[i] || 0;
    }

    // Derive single/multi pin spare counts from pinCounts/missedCounts
    const singlePinSpares = pinCounts[1] || 0;
    const singlePinSpareOpportunities = (pinCounts[1] || 0) + (missedCounts[1] || 0);
    let multiPinSpares = 0;
    let multiPinSpareOpportunities = 0;
    for (let i = 2; i <= MAX_FRAMES; i++) {
      multiPinSpares += pinCounts[i] || 0;
      multiPinSpareOpportunities += (pinCounts[i] || 0) + (missedCounts[i] || 0);
    }

    // Core aggregated stats
    const totalGames = gameHistory.length;
    const averageScore = totalPins / totalGames || 0;
    const cleanGamePercentage = (cleanGameCount / totalGames) * 100 || 0;
    const averageStrikesPerGame = totalStrikes / totalGames || 0;
    const averageSparesPerGame = totalSparesConverted / totalGames || 0;
    const averageOpensPerGame = totalSparesMissed / totalGames || 0;
    const strikePercentage = (totalStrikes / totalFirstThrowCount) * 100 || 0;
    const sparePercentage = (totalSparesConverted / totalFirstThrowCount) * 100 || 0;
    const openPercentage = (totalSparesMissed / totalFirstThrowCount) * 100 || 0;
    const averageFirstCount = firstThrowCount / totalFirstThrowCount || 0;
    const spareRates = pinCounts.map((c, i) => this.getRate(c, missedCounts[i]));
    const overallSpareRate = this.getRate(totalSparesConverted, totalSparesMissed);
    const overallMissedRate = totalSparesMissed > 0 ? 100 - overallSpareRate : 0;
    // TODO maybe use totalframes here
    const markPercentage = ((totalFirstThrowCount - totalSparesMissed) / totalFirstThrowCount) * 100 || 0;

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = minT !== null && maxT !== null ? Math.ceil((maxT - minT) / msPerDay) + 1 : 0;
    const weeks = totalDays / 7;
    const months = totalDays / 30;
    const averageGamesPerWeek = totalGames / weeks || 0;
    const averageGamesPerMonth = totalGames / months || 0;
    const averageGamesPerYear = totalGames / (totalDays / 365) || 0;
    const averageSessionsPerWeek = distinctDays.size / weeks || 0;
    const averageSessionsPerMonth = distinctDays.size / months || 0;
    const averageGamesPerSession = totalGames / distinctDays.size || 0;

    // Strike-to-strike percentage
    const strikeToStrikePercentage = strikeFollowUpsPossible ? (strikeFollowUps / strikeFollowUpsPossible) * 100 : 0;

    // Pin-specific percentages
    const pocketHitPercentage = totalFirstBalls > 0 ? (pocketHits / totalFirstBalls) * 100 : 0;
    const singlePinSparePercentage = singlePinSpareOpportunities > 0 ? (singlePinSpares / singlePinSpareOpportunities) * 100 : 0;
    const multiPinSparePercentage = multiPinSpareOpportunities > 0 ? (multiPinSpares / multiPinSpareOpportunities) * 100 : 0;

    // Non-split spares = (total opens + total spares) - splits
    // Total spare opportunities = all spares converted + all spares missed
    const totalSpareOpportunities = totalSparesConverted + totalSparesMissed;
    const nonSplitSpares = totalSparesConverted - splits;
    const nonSplitSpareOpportunities = totalSpareOpportunities - splitOpportunities;
    const nonSplitSparePercentage = nonSplitSpareOpportunities > 0 ? (nonSplitSpares / nonSplitSpareOpportunities) * 100 : 0;

    const splitConversionPercentage = splitOpportunities > 0 ? (splits / splitOpportunities) * 100 : 0;
    const makeableSplitPercentage = makeableSplitOpportunities > 0 ? (makeableSplits / makeableSplitOpportunities) * 100 : 0;

    return {
      totalStrikes,
      totalSpares: totalSparesConverted,
      totalSparesConverted,
      totalSparesMissed,
      pinCounts,
      missedCounts,
      perfectGameCount,
      cleanGameCount,
      cleanGamePercentage,
      totalGames,
      averageScore,
      highGame,
      lowGame,
      averageStrikesPerGame,
      averageSparesPerGame,
      averageOpensPerGame,
      markPercentage,
      strikePercentage,
      sparePercentage,
      openPercentage,
      averageFirstCount,
      spareRates,
      overallSpareRate,
      totalPins,
      overallMissedRate,
      longestStrikeStreak,
      longestOpenStreak,
      dutch200Count,
      varipapa300Count,
      strikeoutCount,
      allSparesGameCount,
      turkeyCount: streakCounts[3],
      bagger4Count: streakCounts[4],
      bagger5Count: streakCounts[5],
      bagger6Count: streakCounts[6],
      bagger7Count: streakCounts[7],
      bagger8Count: streakCounts[8],
      bagger9Count: streakCounts[9],
      bagger10Count: streakCounts[10],
      bagger11Count: streakCounts[11],
      streakCounts,
      // Inject series stats here
      average3SeriesScore: seriesStats.average3SeriesScore,
      high3Series: seriesStats.high3Series,
      average4SeriesScore: seriesStats.average4SeriesScore,
      high4Series: seriesStats.high4Series,
      average5SeriesScore: seriesStats.average5SeriesScore,
      high5Series: seriesStats.high5Series,
      average6SeriesScore: seriesStats.average6SeriesScore,
      high6Series: seriesStats.high6Series,
      averageGamesPerWeek,
      averageGamesPerMonth,
      averageGamesPerYear,
      averageSessionsPerWeek,
      averageSessionsPerMonth,
      averageGamesPerSession,
      strikeToStrikePercentage,
      // Pin-specific stats
      pocketHits,
      totalFirstBalls,
      pocketHitPercentage,
      singlePinSpares,
      singlePinSpareOpportunities,
      multiPinSpares,
      multiPinSpareOpportunities,
      nonSplitSpares,
      nonSplitSpareOpportunities,
      splits,
      splitOpportunities,
      singlePinSparePercentage,
      multiPinSparePercentage,
      nonSplitSparePercentage,
      splitConversionPercentage,
      makeableSplits,
      makeableSplitOpportunities,
      makeableSplitPercentage,
    };
  }

  calculateGamesForTargetAverage(targetAvg: number, stats: Stats, steps = 15): { gamesNeeded: number; score: number }[] {
    const N0 = stats.totalGames;
    const A0 = stats.averageScore;
    const MAX_SCORE = 300;

    if (N0 === 0 || targetAvg <= A0) {
      return [{ score: Math.ceil(A0 / 5) * 5, gamesNeeded: 0 }];
    }

    const startScore = Math.ceil(A0 / 5) * 5;
    const allScores: number[] = [];
    for (let s = startScore; s <= MAX_SCORE; s += 5) {
      allScores.push(s);
    }

    const L = allScores.length;
    const results: { gamesNeeded: number; score: number }[] = [];
    for (let j = 0; j < steps; j++) {
      const idx = Math.round((j * (L - 1)) / (steps - 1));
      const S = allScores[idx];

      let gamesNeeded = Infinity;
      if (S > targetAvg) {
        const k = (N0 * (targetAvg - A0)) / (S - targetAvg);
        gamesNeeded = k > 0 ? Math.ceil(k) : Infinity;
      }

      if (isFinite(gamesNeeded)) {
        results.push({ score: S, gamesNeeded });
      }
    }

    return results;
  }
  private getRate(converted: number, missed: number): number {
    if (converted + missed === 0) {
      return 0;
    }
    return (converted / (converted + missed)) * 100;
  }
}
