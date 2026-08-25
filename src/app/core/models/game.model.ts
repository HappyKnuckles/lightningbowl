/**
 * Represents a single throw/ball in a bowling frame
 */
export interface Throw {
  isSplit?: boolean;
  pinsKnockedDown?: number[];
  pinsLeftStanding?: number[];
  throwIndex: number;
  value: number;
}

/**
 * Represents a single frame in a bowling game
 */
export interface Frame {
  frameIndex: number;
  isInvalid?: boolean;
  throws: Throw[];
}

/**
 * Represents the state of the pin input mode for a game, including current frame/throw and the data for all throws
 */
export interface PinModeState {
  currentFrameIndex: number;
  currentThrowIndex: number;
  throwsData: Throw[][];
}

/**
 * Represents a draft of a game or series being tracked, used for auto-saving and restoring in-progress data
 */
export interface GameDraft {
  gameIndex: string;
  games: Game[];
  isPinInputMode: boolean;
  maxScores: number[];
  pinModeState: PinModeState[];
  segments: string[];
  selectedMode: string;
  timestamp: number;
  totalScores: number[];
}

/**
 * Represents a complete bowling game
 */
export interface Game {
  balls?: string[];
  date: number;
  frames: Frame[];
  frameScores: number[];
  gameId: string;
  isClean: boolean;
  isPerfect: boolean;
  isPinMode: boolean;
  isPractice: boolean;
  isSeries?: boolean;
  league?: string;
  note?: string;
  patterns: string[];
  seriesId?: string;
  totalScore: number;
}
