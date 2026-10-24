import { BallDrilling, BallLayout, LayoutSystem } from '../../models/ball.model';
import { BowlerFit, GripStyle } from '../../models/fit.model';

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': ' 1/2',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
};

export const LAYOUT_SYSTEM_LABELS: Record<LayoutSystem, string> = {
  'dual-angle': 'Dual Angle',
  vls: 'VLS / 2LS',
};

/** Frequently used starting layouts, offered as quick picks before fine-tuning the numbers. */
export const LAYOUT_PRESETS: BallLayout[] = [
  { system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 },
  { system: 'dual-angle', drillingAngle: 50, pinToPap: 4.5, valAngle: 40 },
  { system: 'dual-angle', drillingAngle: 55, pinToPap: 4, valAngle: 45 },
  { system: 'dual-angle', drillingAngle: 70, pinToPap: 4.5, valAngle: 60 },
  { system: 'vls', pinToPap: 5, psaToPap: 3, pinBuffer: 2 },
  { system: 'vls', pinToPap: 5, psaToPap: 4, pinBuffer: 2 },
  { system: 'vls', pinToPap: 4, psaToPap: 4, pinBuffer: 2 },
  { system: 'vls', pinToPap: 4, psaToPap: 5, pinBuffer: 3 },
];

/** True when every value of the layout's system is set. */
export function isCompleteLayout(layout: BallLayout): boolean {
  const values =
    layout.system === 'dual-angle' ? [layout.drillingAngle, layout.pinToPap, layout.valAngle] : [layout.pinToPap, layout.psaToPap, layout.pinBuffer];
  return values.every((value) => value !== undefined);
}

/** Same system and the same values as written on a drill sheet (rounded to the nearest 64th / 0.1°). */
export function isSameLayout(a: BallLayout, b: BallLayout): boolean {
  return a.system === b.system && formatLayout(a) === formatLayout(b);
}

export const GRIP_STYLE_LABELS: Record<GripStyle, string> = {
  fingertip: 'Fingertip',
  'semi-fingertip': 'Semi-Fingertip',
  conventional: 'Conventional',
};

/**
 * Parses a length the way it's written on drill sheets: "4", "4.5", "4,5", "4 1/2", "4-1/2", "4½", "21/64", '4 1/2"'.
 * Returns undefined for empty input and NaN for anything unreadable.
 */
export function parseInches(input: string | number | null | undefined): number | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : Number.NaN;
  }
  let text = input.trim().toLowerCase();
  if (!text) {
    return undefined;
  }
  for (const [glyph, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.split(glyph).join(replacement);
  }
  text = text
    .replace(/(inches|inch|in|")$/, '')
    .replace(',', '.')
    .trim();

  const sign = text.startsWith('-') ? -1 : 1;
  text = text.replace(/^[-+]\s*/, '');

  // "4 1/2" or "4-1/2"
  const mixed = text.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    return sign * fraction(Number(mixed[1]), Number(mixed[2]), Number(mixed[3]));
  }
  const simpleFraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (simpleFraction) {
    return sign * fraction(0, Number(simpleFraction[1]), Number(simpleFraction[2]));
  }
  if (/^(\d+\.?\d*|\.\d+)$/.test(text)) {
    return sign * Number(text);
  }
  return Number.NaN;
}

function fraction(whole: number, numerator: number, denominator: number): number {
  return denominator === 0 ? Number.NaN : whole + numerator / denominator;
}

/** PAP vertical distance: accepts a signed length or "<length> up" / "<length> down". Up is positive. */
export function parsePapVertical(input: string | number | null | undefined): number | undefined {
  if (typeof input !== 'string') {
    return parseInches(input);
  }
  const match = input
    .trim()
    .toLowerCase()
    .match(/^(.*?)\s*(up|down)$/);
  if (!match) {
    return parseInches(input);
  }
  const value = parseInches(match[1]);
  if (value === undefined || Number.isNaN(value) || value < 0) {
    return Number.NaN;
  }
  return match[2] === 'down' ? -value : value;
}

/** Angle in degrees: "45", "45°", "47.5". */
export function parseDegrees(input: string | number | null | undefined): number | undefined {
  if (typeof input === 'string') {
    return parseInches(input.replace('°', ''));
  }
  return parseInches(input);
}

/** Formats inches as drill-sheet fractions rounded to the nearest 64th: 4.5 → "4 1/2", 0.640625 → "41/64". */
export function formatInches(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const sign = value < 0 ? '-' : '';
  let sixtyFourths = Math.round(Math.abs(value) * 64);
  const whole = Math.floor(sixtyFourths / 64);
  sixtyFourths -= whole * 64;
  if (sixtyFourths === 0) {
    return `${sign}${whole}`;
  }
  let numerator = sixtyFourths;
  let denominator = 64;
  while (numerator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  return whole === 0 ? `${sign}${numerator}/${denominator}` : `${sign}${whole} ${numerator}/${denominator}`;
}

export function formatDegrees(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '';
  }
  return `${Number(value.toFixed(1))}°`;
}

const inch = (value: number | undefined): string => (value === undefined ? '?' : `${formatInches(value)}"`);
const degrees = (value: number | undefined): string => (value === undefined ? '?' : formatDegrees(value));

/** "45° × 4 1/2" × 30°" (Dual Angle) or "5" × 4" × 2"" (VLS / 2LS); empty when nothing is set. */
export function formatLayout(layout: BallLayout | undefined): string {
  if (!layout) {
    return '';
  }
  if (layout.system === 'dual-angle') {
    const { drillingAngle, pinToPap, valAngle } = layout;
    if (drillingAngle === undefined && pinToPap === undefined && valAngle === undefined) {
      return '';
    }
    return `${degrees(drillingAngle)} × ${inch(pinToPap)} × ${degrees(valAngle)}`;
  }
  const { pinToPap, psaToPap, pinBuffer } = layout;
  if (pinToPap === undefined && psaToPap === undefined && pinBuffer === undefined) {
    return '';
  }
  return `${inch(pinToPap)} × ${inch(psaToPap)} × ${inch(pinBuffer)}`;
}

/** Hole sizes as a compact tag: "T 63/64 · M 41/64 · R 39/64"; the thumb is left out for two-handers. */
export function formatHoleSizes(drilling: BallDrilling | undefined, twoHanded = false): string {
  if (!drilling) {
    return '';
  }
  const holes: [string, number | undefined][] = [
    ['T', twoHanded ? undefined : drilling.thumbSize],
    ['M', drilling.middleFingerSize],
    ['R', drilling.ringFingerSize],
  ];
  return holes
    .filter(([, size]) => size !== undefined)
    .map(([label, size]) => `${label} ${formatInches(size)}`)
    .join(' · ');
}

/** '5 1/4" over, 3/4" up'; a vertical of 0 is written as 0" (PAP on the midline). */
export function formatPap(fit: BowlerFit | undefined): string {
  if (!fit || (fit.papOver === undefined && fit.papVertical === undefined)) {
    return '';
  }
  const parts: string[] = [];
  if (fit.papOver !== undefined) {
    parts.push(`${formatInches(fit.papOver)}" over`);
  }
  if (fit.papVertical !== undefined) {
    const vertical = fit.papVertical;
    parts.push(vertical === 0 ? '0"' : `${formatInches(Math.abs(vertical))}" ${vertical > 0 ? 'up' : 'down'}`);
  }
  return parts.join(', ');
}

/** "4 1/8" / 4 1/4"" (middle / ring); a single side alone when only one is set. */
export function formatSpan(fit: BowlerFit | undefined): string {
  if (!fit || (fit.middleSpan === undefined && fit.ringSpan === undefined)) {
    return '';
  }
  if (fit.middleSpan !== undefined && fit.ringSpan !== undefined) {
    return `${formatInches(fit.middleSpan)}" / ${formatInches(fit.ringSpan)}"`;
  }
  return `${formatInches(fit.middleSpan ?? fit.ringSpan)}"`;
}

/** One-line fit summary: 'Fingertip · Span 4 1/8" / 4 1/4" · PAP 5 1/4" over, 3/4" up', or 'Two-Handed · PAP …'. */
export function formatBowlerFit(fit: BowlerFit | undefined): string {
  if (!fit) {
    return '';
  }
  const parts: string[] = [];
  if (fit.style === 'two-handed') {
    parts.push('Two-Handed');
  } else {
    if (fit.grip) {
      parts.push(GRIP_STYLE_LABELS[fit.grip]);
    }
    const span = formatSpan(fit);
    if (span) {
      parts.push(`Span ${span}`);
    }
  }
  const pap = formatPap(fit);
  if (pap) {
    parts.push(`PAP ${pap}`);
  }
  return parts.join(' · ');
}

/** Drops undefined fields so stored records stay small; returns undefined when nothing is left. */
export function compact<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}
