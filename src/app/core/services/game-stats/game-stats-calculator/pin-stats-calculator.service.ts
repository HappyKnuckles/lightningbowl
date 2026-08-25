import { Injectable } from '@angular/core';
import { Frame, Game } from 'src/app/core/models/game.model';
import { LeaveStats } from 'src/app/core/models/stats.model';

@Injectable({
  providedIn: 'root',
})
export class PinStatsCalculatorService {
  calculateAllLeaves(games: Game[]): LeaveStats[] {
    const pinModeGames = games.filter((game) => game.isPinMode);
    const leaveMap = new Map<string, { pins: number[]; occurrences: number; pickups: number }>();

    pinModeGames.forEach((game) => {
      game.frames.forEach((frame: Frame, idx: number) => {
        if (frame.throws && frame.throws.length > 0) {
          const firstThrow = frame.throws[0];

          // 1. Standard First Throw
          if (firstThrow && firstThrow.value !== 10 && firstThrow.pinsLeftStanding) {
            this.processThrow(leaveMap, firstThrow.pinsLeftStanding, frame.throws[1]?.value, firstThrow.value);
          }

          // 2. 10th Frame Special Cases
          if (idx === 9 && firstThrow && firstThrow.value === 10 && frame.throws[1]) {
            const secondThrow = frame.throws[1];
            if (secondThrow && secondThrow.value !== 10 && secondThrow.pinsLeftStanding) {
              const thirdThrow = frame.throws[2];
              const secondVal = secondThrow.value || 0;
              const thirdVal = thirdThrow?.value || 0;
              this.processThrow(leaveMap, secondThrow.pinsLeftStanding, thirdVal, secondVal);
            }
          }
        }
      });
    });

    return Array.from(leaveMap.values()).map((leave) => ({
      ...leave,
      pickupPercentage: leave.occurrences > 0 ? (leave.pickups / leave.occurrences) * 100 : 0,
      missPercentage: leave.occurrences > 0 ? ((leave.occurrences - leave.pickups) / leave.occurrences) * 100 : 0,
    }));
  }

  getLeaveAnalytics(games: Game[]): {
    common: LeaveStats[];
    best: LeaveStats[];
    worst: LeaveStats[];
  } {
    const allLeaves = this.calculateAllLeaves(games);

    return {
      common: this.getMostCommonLeaves(allLeaves),
      best: this.getBestSpares(allLeaves),
      worst: this.getWorstSpares(allLeaves),
    };
  }

  // TODO maybe make the amount be configurable
  getMostCommonLeaves(allLeaves: LeaveStats[]): LeaveStats[] {
    return [...allLeaves].sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);
  }
  // TODO maybe make these exclusive so that best and worst dont overlap (choose second best/worst if so)
  getBestSpares(allLeaves: LeaveStats[]): LeaveStats[] {
    const significant = allLeaves.filter((l) => l.occurrences >= 2 && l.pickups > 0);
    const single = this.findBest(significant.filter((l) => l.pins.length === 1));
    const multi = this.findBest(significant.filter((l) => l.pins.length > 1));

    return [single, multi].filter((x): x is LeaveStats => x !== null);
  }

  getWorstSpares(allLeaves: LeaveStats[]): LeaveStats[] {
    const significant = allLeaves.filter((l) => l.occurrences >= 2 && l.occurrences - l.pickups > 0);
    const single = this.findWorst(significant.filter((l) => l.pins.length === 1));
    const multi = this.findWorst(significant.filter((l) => l.pins.length > 1));

    return [single, multi].filter((x): x is LeaveStats => x !== null);
  }

  private processThrow(
    map: Map<string, { pins: number[]; occurrences: number; pickups: number }>,
    pinsLeft: number[],
    nextThrowValue: number | undefined,
    currentThrowValue: number,
  ) {
    if (!pinsLeft || pinsLeft.length === 0) return;

    const sortedPins = [...pinsLeft].sort((a, b) => a - b);
    const key = sortedPins.join(',');

    if (!map.has(key)) {
      map.set(key, { pins: sortedPins, occurrences: 0, pickups: 0 });
    }

    const leave = map.get(key)!;
    leave.occurrences++;

    const nextVal = nextThrowValue ?? 0;
    if (currentThrowValue + nextVal === 10) {
      leave.pickups++;
    }
  }

  private findBest(leaves: LeaveStats[]): LeaveStats | null {
    if (leaves.length === 0) return null;
    return leaves.sort((a, b) => {
      const scoreA = (a.pickups + 2) / (a.occurrences + 4);
      const scoreB = (b.pickups + 2) / (b.occurrences + 4);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.pickupPercentage - a.pickupPercentage;
    })[0];
  }

  private findWorst(leaves: LeaveStats[]): LeaveStats | null {
    if (leaves.length === 0) return null;
    return leaves.sort((a, b) => {
      const missesA = a.occurrences - a.pickups;
      const missesB = b.occurrences - b.pickups;
      const scoreA = (missesA + 2) / (a.occurrences + 4);
      const scoreB = (missesB + 2) / (b.occurrences + 4);

      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.occurrences - a.occurrences;
    })[0];
  }
}
