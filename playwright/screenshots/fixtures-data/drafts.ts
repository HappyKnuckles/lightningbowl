/**
 * Builders for the `bowling_game_draft` localStorage entry the Add Game page
 * restores on load. Seeding a draft is the most robust way to screenshot a
 * filled scorecard without scripting dozens of fragile cell inputs.
 *
 * The timestamp is set far in the future so the draft never expires regardless
 * of the real wall-clock when the screenshots are generated.
 */
import type { Game } from '../../../src/app/core/models/game.model';
import { buildGame, type GameMeta } from '../lib/scoring';
import { REFERENCE_NOW } from '../lib/constants';

const NEVER_EXPIRES = Date.UTC(3000, 0, 1);

export interface DraftInput {
  mode: 'Single' | '3 Series' | '4 Series' | '5 Series' | '6 Series';
  frameSets: number[][][];
}

function emptyPinState(game: Game) {
  return {
    currentFrameIndex: game.frames.length - 1,
    currentThrowIndex: Math.max(0, (game.frames.at(-1)?.throws.length ?? 1) - 1),
    throwsData: [],
  };
}

/** Serialised GameDraft ready to drop into localStorage. */
export function makeDraft({ mode, frameSets }: DraftInput): string {
  const games: Game[] = frameSets.map((frames, i) => {
    const meta: GameMeta = { gameId: `draft-${i}`, date: REFERENCE_NOW, patterns: [] };
    return buildGame(frames, meta);
  });

  const draft = {
    timestamp: NEVER_EXPIRES,
    games,
    pinModeState: games.map(emptyPinState),
    totalScores: games.map((g) => g.totalScore),
    maxScores: games.map((g) => g.totalScore),
    isPinInputMode: false,
    selectedMode: mode,
    gameIndex: 'Game 1',
    segments: games.map((_, i) => `Game ${i + 1}`),
  };

  return JSON.stringify(draft);
}
