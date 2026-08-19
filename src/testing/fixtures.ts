import { Ball } from 'src/app/core/models/ball.model';
import { Frame, Game } from 'src/app/core/models/game.model';
import { Pattern } from 'src/app/core/models/pattern.model';

/** Ten empty frames, the shape every game starts from. */
export function makeFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, frameIndex) => ({ frameIndex, throws: [] }));
}

/** Minimal valid `Game`. Override any field via `overrides`. */
export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    gameId: 'game-1',
    date: Date.UTC(2026, 0, 1),
    frames: makeFrames(),
    totalScore: 0,
    frameScores: Array(10).fill(0),
    isClean: false,
    isPerfect: false,
    isPractice: false,
    isPinMode: false,
    patterns: [],
    ...overrides,
  };
}

/** Minimal valid `Pattern`. Override any field via `overrides`. */
export function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    url: '',
    title: 'Test Pattern',
    category: 'Sport',
    distance: '39',
    ratio: '5:1',
    volume: '25',
    forward: '',
    reverse: '',
    pump: '',
    pdf_url: '',
    kosi_url: '',
    forwards_data: [],
    reverse_data: [],
    chart_standard: '',
    chart_horizontal: '',
    ...overrides,
  };
}

/** Minimal valid `Ball`. Override any field via `overrides`. */
export function makeBall(overrides: Partial<Ball> = {}): Ball {
  return {
    availability: 'Available',
    ball_id: 'ball-1',
    ball_image: '',
    ball_name: 'Test Ball',
    brand_id: 'brand-1',
    brand_name: 'Test Brand',
    core_diff: '0.045',
    core_id: 'core-1',
    core_image: '',
    core_int_diff: '0',
    core_name: 'Test Core',
    core_rg: '2.5',
    core_type: 'Symmetric',
    core_weight: '15',
    coverstock_id: 'cover-1',
    coverstock_name: 'Test Coverstock',
    coverstock_type: 'Reactive',
    factory_finish: '500 Siaair',
    last_update: '',
    release_date: '2025',
    thumbnail_image: '',
    us_int: 'US',
    ...overrides,
  };
}
