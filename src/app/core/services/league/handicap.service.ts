import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { HandicapConfig, HandicapEntry } from 'src/app/core/models/league';
import { groupGamesIntoSessions } from 'src/app/core/utils/sort-utils/sort.utils';

@Injectable({ providedIn: 'root' })
export class HandicapService {
  /**
   * Handicap for a given average under a config.
   * - scratch:        always 0
   * - percentOfBase:  floor(percentage% * (baseScore - average)), never below 0
   *                   e.g. 90% of 220 at avg 180 → 0.9 * 40 = 36
   * - custom:         not auto-calculated (returns 0)
   */
  handicapForAverage(config: HandicapConfig, average: number): number {
    if (config.system !== 'percentOfBase') {
      return 0;
    }
    const diff = config.baseScore - average;
    if (diff <= 0) {
      return 0;
    }
    return Math.floor((config.percentage / 100) * diff);
  }

  /** Convenience: a scratch score plus the bowler's handicap. */
  handicapScore(config: HandicapConfig, scratchScore: number, average: number): number {
    return scratchScore + this.handicapForAverage(config, average);
  }

  /**
   * Builds a handicap history by walking the games chronologically (one entry per league
   * night), recomputing the running average and the resulting handicap after each night.
   */
  buildHandicapHistory(config: HandicapConfig, games: Game[]): HandicapEntry[] {
    const sessions = groupGamesIntoSessions(games);
    const history: HandicapEntry[] = [];
    let pinTotal = 0;
    let gameCount = 0;
    for (const session of sessions) {
      for (const game of session.games) {
        pinTotal += game.totalScore;
        gameCount += 1;
      }
      const average = gameCount > 0 ? pinTotal / gameCount : 0;
      history.push({ date: session.date, average, handicap: this.handicapForAverage(config, average) });
    }
    return history;
  }
}
