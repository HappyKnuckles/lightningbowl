/**
 * Builder for the `bowling_game_draft` localStorage entry the Add Game page
 * restores on load.
 *
 * The timestamp is set far in the future so the draft never expires regardless
 * of the real wall-clock when the screenshots are generated.
 */
import { buildPinGame, type PinFrame } from '../lib/scoring';
import { REFERENCE_NOW } from '../lib/constants';

const NEVER_EXPIRES = Date.UTC(3000, 0, 1);

/**
 * An in-progress *pin-mode* game: the `played` frames are entered pin-by-pin
 * (so each renders a mini pin-deck in the grid). `current` is the frame still
 * being entered — pass a single first ball (e.g. `firstBall([10])`) so the last
 * frame on the card shows one throw of input with the deck on the next ball.
 * Omit `current` to park the deck on a fresh rack. Played + current must be
 * fewer than 10 frames.
 */
export function makePinDraft(played: PinFrame[], current: PinFrame = []): string {
  const frames: PinFrame[] = [...played];
  if (current.length) frames.push(current);
  while (frames.length < 10) frames.push([]);

  const game = buildPinGame(frames, { gameId: 'draft-0', date: REFERENCE_NOW, patterns: [] });

  const draft = {
    timestamp: NEVER_EXPIRES,
    games: [game],
    pinModeState: [{ currentFrameIndex: played.length, currentThrowIndex: current.length, throwsData: game.frames.map((f) => f.throws) }],
    totalScores: [game.totalScore],
    maxScores: [game.totalScore],
    isPinInputMode: true,
    selectedMode: 'Single',
    gameIndex: 'Game 1',
    segments: ['Game 1'],
  };

  return JSON.stringify(draft);
}
