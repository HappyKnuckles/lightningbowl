import { makePattern } from 'src/testing/fixtures';

import { ForwardsData } from '../../models/pattern.model';
import { ShotAnalysisResult } from '../../models/shot-analysis.model';
import {
  boardAtDistance,
  boardFromLeft,
  isInOil,
  parseBoardEdge,
  patternDistanceFt,
  patternOilRects,
  patternRatioColor,
  withPatternRows,
} from './pattern-overlay.utils';
import { shotMetricRows } from './shot-analysis.utils';

function row(start: string, stop: string, totalOil: string, from: string, to: string): ForwardsData {
  return { number: '', start, stop, load: '', mics: '', speed: '', buf: '', tank: '', total_oil: totalOil, distance_start: from, distance_end: to };
}

// cut down from a 37 ft, 2.92:1 house shot: oil out to 24.64 ft going down, buffed on the way back
const PATTERN = makePattern({
  distance: "37'",
  ratio: '2.92:1',
  forwards_data: [row('2L', '2R', '3.330', '0.00', '1.96'), row('10L', '10R', '2.835', '17.08', '24.64'), row('2L', '2R', '0', '24.64', '37.00')],
  reverse_data: [row('2L', '2R', '0', '37.00', '30.00'), row('9L', '9R', '2.070', '30.00', '24.96'), row('2L', '2R', '0', '8.16', '0.00')],
});

function shot(): ShotAnalysisResult {
  return {
    handedness: 'right',
    fps: 60,
    framesProcessed: 300,
    trackedFromFt: 2,
    trackedToFt: 60,
    points: [],
    curve: [
      { distanceFt: 2, board: 15 },
      { distanceFt: 30, board: 10 },
      { distanceFt: 40, board: 8 },
      { distanceFt: 60, board: 17.5 },
    ],
    metrics: { arrowsBoard: 13.9, breakpoint: { distanceFt: 40, board: 8 }, entryBoard: 17.5, entryBoardExtrapolated: false },
  };
}

describe('pattern overlay utils', () => {
  it('reads boards from either edge like the chart generator', () => {
    expect(parseBoardEdge('2L')).toBe(2);
    expect(parseBoardEdge('10R')).toBe(29);
    expect(parseBoardEdge(' 1r ')).toBe(38);
  });

  it('colours by ratio like the charts', () => {
    expect(patternRatioColor('2.92:1')).toBe('red');
    expect(patternRatioColor('5:1')).toBe('#ed8e07');
    expect(patternRatioColor('10:1')).toBe('green');
    expect(patternRatioColor(undefined)).toBe('blue');
  });

  it('reads the oil length', () => {
    expect(patternDistanceFt(PATTERN)).toBe(37);
    expect(patternDistanceFt(makePattern({ distance: '' }))).toBeNull();
  });

  it('layers a wash, the oiled forward passes and the reverse passes, including the ones ending at the foul line', () => {
    const rects = patternOilRects(PATTERN);
    expect(rects.map((r) => [r.key, r.opacity])).toEqual([
      ['wash', 0.1],
      ['forward-0', 0.5],
      ['forward-1', 0.5],
      ['reverse-1', 0.3],
      ['reverse-2', 0.3],
    ]);
    expect(rects[0]).toMatchObject({ left: 1, right: 38, fromFt: 0, toFt: 37 });
    expect(rects[2]).toMatchObject({ left: 10, right: 29, fromFt: 17.08, toFt: 24.64 });
    expect(rects[4]).toMatchObject({ fromFt: 0, toFt: 8.16 });
  });

  it('adds a lighter wash for the forward length when the passes end at different distances', () => {
    const pattern = makePattern({ forwards_data: [row('2L', '2R', '3', '0', '40')], reverse_data: [row('2L', '2R', '3', '30', '0')] });
    expect(patternOilRects(pattern).slice(0, 2)).toMatchObject([
      { key: 'wash-forward', opacity: 0.05, toFt: 40 },
      { key: 'wash', opacity: 0.1, toFt: 30 },
    ]);
  });

  it('maps shot boards to the lane edge for both hands', () => {
    expect(boardFromLeft(1, 'right')).toBe(38.5);
    expect(boardFromLeft(1, 'left')).toBe(0.5);
  });

  it('finds oil only where a pass puts some', () => {
    expect(isInOil(PATTERN, boardFromLeft(20, 'right'), 20)).toBe(true);
    expect(isInOil(PATTERN, boardFromLeft(5, 'right'), 20)).toBe(false);
  });

  it('interpolates the ball path', () => {
    expect(boardAtDistance(shot().curve, 35)).toBeCloseTo(9, 5);
    expect(boardAtDistance(shot().curve, 1)).toBeNull();
  });

  it('relates the shot to the pattern in the metric rows', () => {
    const result = shot();
    const rows = withPatternRows(shotMetricRows(result), result, PATTERN);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

    expect(byLabel['Breakpoint']).toMatchObject({ detail: 'at 40 ft · 3 ft past the pattern', highlight: true });
    expect(byLabel['Arrows'].detail).toBe('at 15 ft · outside the oil');
    expect(byLabel['Exit from Oil']).toEqual({ label: 'Exit from Oil', value: 'Board 8.6', detail: 'at 37 ft, end of the pattern' });
    expect(rows.findIndex((r) => r.label === 'Exit from Oil')).toBe(rows.findIndex((r) => r.label === 'Arrows') + 1);
  });
});
