/**
 * Minimized ball reference stored per throw
 */
export interface ThrowBall {
  name: string;
  weight?: string;
}

/**
 * Represents a single throw/ball in a bowling frame
 */
export interface Throw {
  value: number;
  throwIndex: number;
  isSplit?: boolean;
  pinsLeftStanding?: number[];
  pinsKnockedDown?: number[];
  ball?: ThrowBall;
}

/**
 * Represents a single frame in a bowling game
 */
export interface Frame {
  frameIndex: number;
  throws: Throw[];
  isInvalid?: boolean;
  /** Ball selected for the next throw in this frame, before that throw has actually been recorded. */
  pendingBall?: ThrowBall;
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
  timestamp: number;
  games: Game[];
  pinModeState: PinModeState[];
  totalScores: number[];
  maxScores: number[];
  isPinInputMode: boolean;
  selectedMode: string;
  gameIndex: string;
  segments: string[];
}

/**
 * Represents a complete bowling game
 */
export interface Game {
  gameId: string;
  date: number;
  frames: Frame[];
  totalScore: number;
  frameScores: number[];
  isClean: boolean;
  isPerfect: boolean;
  isPractice: boolean;
  isPinMode: boolean;
  isSeries?: boolean;
  seriesId?: string;
  note?: string;
  league?: string;
  patterns: string[];
  balls?: string[];
}
