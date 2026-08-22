import { Injectable } from '@angular/core';
import { Game } from 'src/app/core/models/game.model';
import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { byAvg, byGameCount } from 'src/app/core/utils/sort-utils/sort.utils';
import { accumulateItemStats, pickTop } from 'src/app/core/utils/stat-utils/stat.utils';

@Injectable({
  providedIn: 'root',
})
export class PatternStatsCalculatorService {
  constructor(private patternsStore: PatternsStore) {}

  private _calculateAllPatternStats(gameHistory: Game[]): Record<string, HighlightItemStats> {
    const patternImages = this.patternsStore.patternImageMap();
    return accumulateItemStats(
      gameHistory,
      (game) => game.patterns ?? [],
      (patternName) => patternImages[patternName] ?? '',
    );
  }

  calculateAllPatternStats(gameHistory: Game[]): HighlightItemStats[] {
    return Object.values(this._calculateAllPatternStats(gameHistory));
  }

  calculateBestPatternStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllPatternStats(gameHistory), byAvg);
  }

  calculateMostPlayedPatternStats(gameHistory: Game[]): HighlightItemStats {
    return pickTop(this._calculateAllPatternStats(gameHistory), byGameCount);
  }
}
