import { Ball } from 'src/app/core/models/ball.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { getFlareScore, getHookScore, getLengthScore } from './ball-metrics.util';

/** Fits below this score aren't worth recommending at all. */
const MIN_FIT_SCORE = 60;

export interface PatternRecommendation {
  pattern: Partial<Pattern>;
  /** One-line explanation of why this pattern suits the ball. */
  reason: string;
}

interface PatternFacts {
  score: number;
  volume: number;
  distance: number | null;
  ratio: number;
}

/**
 * Recommends oil patterns from the pattern library that suit a ball's specs.
 * The ball's oil-handling capability (derived from RG/diff via hook, flare and
 * length scores — the same weighting getLaneCondition uses) is matched against
 * each pattern's estimated oil demand. The store's stripped pattern list only
 * carries title/category/ratio, so demand falls back from volume → ratio, with
 * pattern length read from the distance field or the trailing number Kegel
 * titles carry (e.g. "Boardwalk 41"). Pure and deterministic.
 */
export function recommendPatternsForBall(ball: Ball, allPatterns: Partial<Pattern>[], limit = 3): PatternRecommendation[] {
  const coverstock = (ball.coverstock_type || '').toLowerCase();
  // Plastic/polyester balls are spare balls — pattern recommendations make no sense.
  if (coverstock.includes('plastic') || coverstock.includes('polyester')) {
    return [];
  }

  const capability = getOilCapability(ball);
  const isUrethane = coverstock.includes('urethane');

  return allPatterns
    .map((pattern) => ({ pattern, facts: evaluatePattern(capability, isUrethane, pattern) }))
    .filter((entry): entry is { pattern: Partial<Pattern>; facts: PatternFacts } => entry.facts !== null && entry.facts.score >= MIN_FIT_SCORE)
    .sort((a, b) => b.facts.score - a.facts.score)
    .slice(0, limit)
    .map((entry) => ({
      pattern: entry.pattern,
      reason: buildReason(capability, isUrethane, entry.facts, entry.pattern.url ?? entry.pattern.title ?? ''),
    }));
}

/** How much oil the ball can handle (0–100), mirroring getLaneCondition's weighting. */
function getOilCapability(ball: Ball): number {
  return getHookScore(ball) * 0.5 + getFlareScore(ball) * 0.3 + (100 - getLengthScore(ball)) * 0.2;
}

/** Scores one pattern against the given capability, or null when it lacks usable data. */
function evaluatePattern(capability: number, isUrethane: boolean, pattern: Partial<Pattern>): PatternFacts | null {
  if (!pattern.title) {
    return null;
  }
  const volume = parseFloat(pattern.volume ?? '');
  const distance = getPatternLength(pattern);
  const ratio = parseFloat((pattern.ratio ?? '').split(':')[0]);

  let demand: number;
  if (!isNaN(volume)) {
    // Oil demand from volume; thresholds match the labels in app-pattern-info.
    if (volume < 22) {
      demand = 25;
    } else if (volume <= 26) {
      demand = 50;
    } else if (volume < 30) {
      demand = 70;
    } else {
      demand = 85;
    }
  } else if (!isNaN(ratio)) {
    // Flatter (sport) patterns play oilier than a broken-down wall: less free
    // hook outside, so they reward stronger, smoother balls.
    if (ratio <= 4) {
      demand = 65;
    } else if (ratio <= 8) {
      demand = 55;
    } else {
      demand = 45;
    }
  } else if (distance !== null) {
    demand = distance <= 35 ? 35 : distance >= 41 ? 65 : 50;
  } else {
    return null;
  }

  // Longer patterns leave less dry backend, demanding an earlier, stronger ball.
  if (distance !== null) {
    if (distance <= 35) {
      demand -= 8;
    } else if (distance >= 41) {
      demand += 8;
    }
  }
  demand = Math.max(0, Math.min(100, demand));

  let score = 100 - Math.abs(capability - demand);

  // Urethane excels at control on short and low-ratio (sport) patterns,
  // but starves for traction on long, heavy patterns.
  const isSport = !isNaN(ratio) && ratio <= 4;
  if (isUrethane) {
    if ((distance !== null && distance <= 36) || isSport) {
      score += 10;
    }
    if (distance !== null && distance >= 41 && isSport) {
      score -= 15;
    }
  }

  // Prefer recent patterns: dated ones (year in the title) age out gradually,
  // capped so a great-fitting classic can still beat a poor-fitting new one.
  // Undated patterns (e.g. Kegel landmark series) stay neutral.
  const year = extractYear(pattern.title);
  if (year !== null) {
    const age = Math.max(0, new Date().getFullYear() - year);
    score -= Math.min(15, age * 0.75);
  }

  return { score, volume, distance, ratio };
}

/** Year a pattern was published, read from titles like "2003 WTBA World Championships". */
function extractYear(title: string | undefined): number | null {
  const match = /\b(19[89]\d|20[0-4]\d)\b/.exec(title ?? '');
  return match ? parseInt(match[1], 10) : null;
}

const URETHANE_PHRASES = [
  "urethane's smooth roll keeps it controllable here",
  'its even urethane motion tames the tricky parts of this shot',
  'a great look for urethane: predictable shape, no over-reaction',
];
const STRONG_BALL_PHRASES = [
  'enough oil for this strong, high-flare cover',
  'its dull cover and strong core dig through the volume',
  "plenty of head oil here, so this ball won't burn up early",
];
const CLEAN_BALL_PHRASES = [
  'lets this cleaner cover save energy for the backend',
  'the drier lanes give its length and backend room to work',
  'light enough that its later breakpoint stays sharp',
];
const BALANCED_BALL_PHRASES = [
  'matches its balanced, all-round motion',
  'a versatile shape this ball handles comfortably',
  "sits right in this ball's comfort zone",
];

/** Builds a short "why this fits" line from the pattern's traits and the ball's motion profile. */
function buildReason(capability: number, isUrethane: boolean, facts: PatternFacts, seed: string): string {
  const patternParts: string[] = [];
  if (!isNaN(facts.ratio)) {
    const ratioText = `${Number.isInteger(facts.ratio) ? facts.ratio : facts.ratio.toFixed(1)}:1`;
    if (facts.ratio <= 4) {
      patternParts.push(`flat ${ratioText} sport pattern`);
    } else if (facts.ratio <= 8) {
      patternParts.push(`${ratioText} challenge pattern`);
    } else {
      patternParts.push(`forgiving ${ratioText} house pattern`);
    }
  }
  if (facts.distance !== null) {
    patternParts.push(
      facts.distance <= 35 ? `short (${facts.distance} ft)` : facts.distance >= 41 ? `long (${facts.distance} ft)` : `${facts.distance} ft`,
    );
  }
  if (!isNaN(facts.volume)) {
    patternParts.push(facts.volume >= 27 ? 'heavy oil' : facts.volume < 22 ? 'light oil' : 'medium oil');
  }
  const patternPart = patternParts.join(', ');

  // Pick the ball-side phrasing deterministically per pattern so neighboring
  // recommendations don't all read the same.
  const phrases = isUrethane
    ? URETHANE_PHRASES
    : capability >= 60
      ? STRONG_BALL_PHRASES
      : capability <= 35
        ? CLEAN_BALL_PHRASES
        : BALANCED_BALL_PHRASES;
  const ballPart = phrases[stableHash(seed) % phrases.length];

  const capitalized = patternPart.charAt(0).toUpperCase() + patternPart.slice(1);
  return `${capitalized} — ${ballPart}`;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Pattern length in feet from the distance field, or the trailing number in the title. */
function getPatternLength(pattern: Partial<Pattern>): number | null {
  const distance = parseFloat(pattern.distance ?? '');
  if (!isNaN(distance)) {
    return distance;
  }
  // Kegel-style titles end with the length, e.g. "Boardwalk 41" or "Beijing 37 ft".
  const match = /\b(3[0-9]|4[0-9]|5[0-5])(?:\s*(?:ft|feet|'))?\s*$/i.exec((pattern.title ?? '').trim());
  return match ? parseInt(match[1], 10) : null;
}
