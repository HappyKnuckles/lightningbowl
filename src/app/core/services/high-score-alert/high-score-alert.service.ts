import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Game } from '../../models/game.model';

export interface GameDetails {
  league?: string;
  patterns?: string[];
  balls?: string[];
  date: string;
}

export interface SeriesDetails {
  seriesType: string;
  scores: number[];
  league?: string;
  date: string;
}

export interface HighScoreRecord {
  type: 'single_game' | 'series';
  newRecord: number;
  previousRecord: number;
  details: GameDetails | SeriesDetails;
  gameOrSeries: Game | Game[];
}

@Injectable({
  providedIn: 'root',
})
export class HighScoreAlertService {
  private alertController = inject(AlertController);

  /**
   * Check if a new game achieves any new high scores and display alerts
   */
  async checkAndDisplayHighScoreAlerts(newGame: Game, allGames: Game[]): Promise<void> {
    const records = await this.checkForNewRecords(newGame, allGames);

    for (const record of records) {
      await this.displayHighScoreAlert(record);
    }
  }

  /**
   * Check for new high score records
   */
  private async checkForNewRecords(newGame: Game, allGames: Game[]): Promise<HighScoreRecord[]> {
    const records: HighScoreRecord[] = [];

    // Get previous stats (all games except the new one)
    const previousGames = allGames.filter((game: Game) => game.gameId !== newGame.gameId);
    const previousStats = this.calculateHighScores(previousGames);

    // Check for new single game high score
    if (newGame.totalScore > (previousStats.highGame || 0)) {
      records.push({
        type: 'single_game',
        newRecord: newGame.totalScore,
        previousRecord: previousStats.highGame || 0,
        details: this.getGameDetails(newGame),
        gameOrSeries: newGame,
      });
    }

    // Check for new series high score if this game is part of a series
    if (newGame.isSeries && newGame.seriesId) {
      const seriesGames = allGames.filter((game: Game) => game.seriesId === newGame.seriesId);
      const seriesGameCount = seriesGames.length;

      // Only alert for series of 3, 4, 5, or 6 games (standard series formats)
      if (seriesGameCount >= 3 && seriesGameCount <= 6) {
        const seriesTotal = seriesGames.reduce((total: number, game: Game) => total + game.totalScore, 0);

        // Get previous best series of the same length
        const previousSeriesScores = this.getPreviousSeriesScores(allGames, newGame.seriesId, seriesGameCount);
        const previousBestSeries = Math.max(...previousSeriesScores, 0);

        if (seriesTotal > previousBestSeries) {
          records.push({
            type: 'series',
            newRecord: seriesTotal,
            previousRecord: previousBestSeries,
            details: this.getSeriesDetails(seriesGames),
            gameOrSeries: seriesGames,
          });
        }
      }
    }

    return records;
  }

  /**
   * Display congratulatory alert for new high score
   */
  public async displayHighScoreAlert(record: HighScoreRecord): Promise<void> {
    const isNewRecord = record.previousRecord === 0;
    const improvementText = isNewRecord ? 'Your first record!' : `Previous best: ${record.previousRecord}`;

    let subHeaderText = record.type === 'single_game' ? 'Single Game Record' : 'Series Record';
    if (record.type === 'series' && 'seriesType' in record.details) {
      const gameCountMatch = record.details.seriesType.match(/(\d+)-Game Series/);
      if (gameCountMatch) {
        subHeaderText = `${gameCountMatch[1]}-Game Series Record`;
      }
    }

    const alert = await this.alertController.create({
      header: 'NEW HIGH SCORE!',
      subHeader: subHeaderText,
      message: `
        <div style="text-align: center; padding: 10px;">
          <h2 style="color: #4CAF50; margin: 10px 0;">${record.newRecord}</h2>
          <p style="margin: 5px 0;"><strong>${improvementText}</strong></p>
          <div style="margin: 5px 0; font-size: 0.9em;">${this.formatStructuredDetailsToHtml(record.details)}</div>
        </div>
      `,
      buttons: [
        {
          text: 'Awesome!',
          role: 'confirm',
          cssClass: 'alert-button-confirm',
        },
      ],
      cssClass: 'high-score-alert',
    });

    await alert.present();
  }

  /**
   * Get formatted game details for display
   */
  private getGameDetails(game: Game): GameDetails {
    return {
      league: game.league || undefined,
      patterns: game.patterns && game.patterns.length > 0 ? game.patterns : undefined,
      balls: game.balls && game.balls.length > 0 ? game.balls : undefined,
      date: new Date(game.date).toLocaleDateString(),
    };
  }

  /**
   * Get formatted series details for display
   */
  private getSeriesDetails(seriesGames: Game[]): SeriesDetails {
    const scores = seriesGames.map((g) => g.totalScore);
    const gameCount = seriesGames.length;
    const seriesTypeText = gameCount ? `${gameCount}-Game Series` : 'Series';

    return {
      seriesType: seriesTypeText,
      scores: scores,
      league: seriesGames[0]?.league || undefined,
      date: new Date(seriesGames[0]?.date || Date.now()).toLocaleDateString(),
    };
  }

  /**
   * Get all previous series scores excluding the current series
   */
  /**
   * Get all previous series scores excluding the current series, optionally filtered by game count
   */
  private getPreviousSeriesScores(allGames: Game[], currentSeriesId: string, targetGameCount?: number): number[] {
    const seriesMap = new Map<string, Game[]>();

    // Group games by series ID, excluding current series
    allGames
      .filter((game: Game) => game.isSeries && game.seriesId && game.seriesId !== currentSeriesId)
      .forEach((game: Game) => {
        if (!seriesMap.has(game.seriesId!)) {
          seriesMap.set(game.seriesId!, []);
        }
        seriesMap.get(game.seriesId!)!.push(game);
      });

    // Calculate total score for each series, optionally filtering by game count
    return Array.from(seriesMap.values())
      .filter((seriesGames: Game[]) => !targetGameCount || seriesGames.length === targetGameCount)
      .map((seriesGames: Game[]) => seriesGames.reduce((total: number, game: Game) => total + game.totalScore, 0));
  }

  /**
   * Calculate high game and high series from a list of games
   */
  private calculateHighScores(games: Game[]): { highGame: number; highSeries: number } {
    if (games.length === 0) {
      return { highGame: 0, highSeries: 0 };
    }

    // Calculate high game
    const highGame = Math.max(...games.map((game) => game.totalScore));

    // Calculate high series by grouping games by seriesId
    const seriesMap = new Map<string, Game[]>();

    games
      .filter((game) => game.isSeries && game.seriesId)
      .forEach((game) => {
        if (!seriesMap.has(game.seriesId!)) {
          seriesMap.set(game.seriesId!, []);
        }
        seriesMap.get(game.seriesId!)!.push(game);
      });

    // Calculate total score for each series and find the highest
    const seriesScores = Array.from(seriesMap.values()).map((seriesGames) => seriesGames.reduce((total, game) => total + game.totalScore, 0));

    const highSeries = seriesScores.length > 0 ? Math.max(...seriesScores) : 0;

    return { highGame, highSeries };
  }

  /**
   * Format structured details to HTML with bold titles and separate lines
   */
  private formatStructuredDetailsToHtml(details: GameDetails | SeriesDetails): string {
    const htmlParts: string[] = [];

    if ('seriesType' in details) {
      // SeriesDetails
      htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>${details.seriesType}:</strong> ${details.scores.join(', ')}</p>`);
      if (details.league) {
        htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>League:</strong> ${details.league}</p>`);
      }
    } else {
      // GameDetails
      if (details.league) {
        htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>League:</strong> ${details.league}</p>`);
      }
      if (details.patterns && details.patterns.length > 0) {
        htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>Patterns:</strong> ${details.patterns.join(', ')}</p>`);
      }
      if (details.balls && details.balls.length > 0) {
        htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>Balls:</strong> ${details.balls.join(', ')}</p>`);
      }
    }

    // Date is common to both types
    htmlParts.push(`<p style="margin: 3px 0; font-size: 0.9em;"><strong>Date:</strong> ${details.date}</p>`);

    return htmlParts.join('');
  }

  /**
   * Check if multiple new games achieve any new high scores and display alerts
   * This method prevents duplicate alerts when saving multiple games (e.g., in a series)
   */
  async checkAndDisplayHighScoreAlertsForMultipleGames(newGames: Game[], allGames: Game[]): Promise<void> {
    if (newGames.length === 0) return;

    const allRecords: HighScoreRecord[] = [];
    const processedSeriesIds = new Set<string>();

    // Get previous stats (all games except the new ones)
    const newGameIds = new Set(newGames.map((game) => game.gameId));
    const previousGames = allGames.filter((game: Game) => !newGameIds.has(game.gameId));
    const previousStats = this.calculateHighScores(previousGames);

    // Check for single game high scores
    for (const newGame of newGames) {
      if (newGame.totalScore > (previousStats.highGame || 0)) {
        // Only add if this is a new high game record (higher than any previous record we've found)
        const existingGameRecord = allRecords.find((r) => r.type === 'single_game');
        if (!existingGameRecord || newGame.totalScore > existingGameRecord.newRecord) {
          // Remove any lower single game record
          if (existingGameRecord) {
            const index = allRecords.indexOf(existingGameRecord);
            allRecords.splice(index, 1);
          }

          allRecords.push({
            type: 'single_game',
            newRecord: newGame.totalScore,
            previousRecord: previousStats.highGame || 0,
            details: this.getGameDetails(newGame),
            gameOrSeries: newGame,
          });
        }
      }
    }

    // Check for series high scores (only once per series)
    for (const newGame of newGames) {
      if (newGame.isSeries && newGame.seriesId && !processedSeriesIds.has(newGame.seriesId)) {
        processedSeriesIds.add(newGame.seriesId);

        const seriesGames = allGames.filter((game: Game) => game.seriesId === newGame.seriesId);
        const seriesGameCount = seriesGames.length;

        // Only alert for series of 3, 4, 5, or 6 games (standard series formats)
        if (seriesGameCount >= 3 && seriesGameCount <= 6) {
          const seriesTotal = seriesGames.reduce((total: number, game: Game) => total + game.totalScore, 0);

          // Get previous best series of the same length
          const previousSeriesScores = this.getPreviousSeriesScores(allGames, newGame.seriesId, seriesGameCount);
          const previousBestSeries = Math.max(...previousSeriesScores, 0);

          if (seriesTotal > previousBestSeries) {
            allRecords.push({
              type: 'series',
              newRecord: seriesTotal,
              previousRecord: previousBestSeries,
              details: this.getSeriesDetails(seriesGames),
              gameOrSeries: seriesGames,
            });
          }
        }
      }
    }

    // Display all unique records
    for (const record of allRecords) {
      await this.displayHighScoreAlert(record);
    }
  }
}
