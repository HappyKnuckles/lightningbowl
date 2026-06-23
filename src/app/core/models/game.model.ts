/**
 * Represents a single throw/ball in a bowling frame
 */
export interface Throw {
  value: number;
  throwIndex: number;
  isSplit?: boolean;
  pinsLeftStanding?: number[];
  pinsKnockedDown?: number[];
}

/**
 * Represents a single frame in a bowling game
 */
export interface Frame {
  frameIndex: number;
  throws: Throw[];
  isInvalid?: boolean;
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
  /** Display name of the league this game belongs to (source of truth for grouping). */
  league?: string;
  /** Relational link to a League aggregate (additive; set by migration / new games). */
  leagueId?: string;
  /** Relational link to the Season within the league. */
  seasonId?: string;
  /** Relational link to the WeeklySession within the season. */
  sessionId?: string;
  patterns: string[];
  balls?: string[];
}
