import { makePattern } from 'src/testing/fixtures';

import { ForwardsData } from '../../models/pattern.model';
import { blockRatios, oilByBoard, oilByFoot, patternFacts, patternRatioColor, rowBoards, rowOilPerBoard, sumBars } from './pattern-oil.utils';

function row(start: string, stop: string, load: string, mics: string, from: string, to: string, totalOil = ''): ForwardsData {
  return { number: '', start, stop, load, mics, speed: '', buf: '', tank: '', total_oil: totalOil, distance_start: from, distance_end: to };
}

describe('pattern oil utils', () => {
  it('reads the boards a row covers from either edge', () => {
    expect(rowBoards({ start: '2L', stop: '2R' })).toEqual([2, 38]);
    expect(rowBoards({ start: '10R', stop: '12L' })).toEqual([12, 30]);
    expect(rowBoards({ start: '1L', stop: '1R' })).toEqual([1, 39]);
  });

  it('takes the oil per board from loads and mics, not the scraped total', () => {
    // "720" is how some patterns were scraped instead of "0.720" mL
    expect(rowOilPerBoard(row('12L', '11R', '1', '40', '23.52', '26.04', '720'))).toBe(40);
    expect(rowOilPerBoard(row('2L', '2R', '0', '45', '30', '37'))).toBe(0);
  });

  it('adds up the oil on each board per direction', () => {
    const pattern = makePattern({
      forwards_data: [row('2L', '2R', '2', '45', '0', '2'), row('10L', '10R', '3', '45', '17', '24')],
      reverse_data: [row('9L', '9R', '2', '45', '30', '25')],
    });
    const bars = oilByBoard(pattern);

    expect(bars.length).toBe(39);
    expect(bars[0]).toEqual({ forward: 0, reverse: 0 });
    expect(bars[1]).toEqual({ forward: 90, reverse: 0 }); // board 2: first row only
    expect(bars[9]).toEqual({ forward: 225, reverse: 90 }); // board 10: both forward rows and the reverse row
    expect(bars[19]).toEqual({ forward: 225, reverse: 90 });
  });

  it('spreads each row over the feet it covers, also on the way back', () => {
    const pattern = makePattern({
      forwards_data: [row('1L', '1R', '1', '10', '0', '2.5')], // 390 µL over 2.5 ft
      reverse_data: [row('1L', '1R', '1', '10', '4', '2')], // 390 µL over 2 ft
    });
    const bars = oilByFoot(pattern, 4);

    expect(bars.length).toBe(4);
    expect(bars[0].forward).toBeCloseTo(156, 5);
    expect(bars[2].forward).toBeCloseTo(78, 5); // half of the third foot
    expect(bars[2].reverse).toBeCloseTo(195, 5);
    expect(bars[3].reverse).toBeCloseTo(195, 5);
  });

  it('gives the centre-to-block ratios like a pattern sheet', () => {
    const pattern = makePattern({
      forwards_data: [row('1L', '1R', '1', '30', '0', '10'), row('10L', '10R', '2', '30', '0', '10')],
      reverse_data: [],
    });
    const ratios = blockRatios(oilByBoard(pattern));

    expect(ratios.map((r) => r.label)).toEqual(['3', '1.36', '1', '1:1', '1', '1.36', '3']);
    expect(ratios[0]).toMatchObject({ from: 3, to: 7 });
  });

  it('shows a dash for a block without oil', () => {
    const pattern = makePattern({ forwards_data: [row('10L', '10R', '1', '30', '0', '10')], reverse_data: [] });
    expect(blockRatios(oilByBoard(pattern))[0].label).toBe('–');
  });

  it('sums up the headline numbers with their categories', () => {
    expect(patternFacts(makePattern({ distance: "37'", ratio: '2.92:1', volume: '26.51', forward: '13.64', reverse: '12.87' }))).toEqual({
      distance: '37 ft',
      length: 'Medium',
      ratio: '2.92:1',
      difficulty: 'Hard',
      volume: '26.51 mL',
      forward: '13.64 mL',
      reverse: '12.87 mL',
    });
    expect(patternFacts(makePattern({ distance: '', ratio: undefined, volume: '', forward: '', reverse: '' }))).toEqual({
      distance: undefined,
      length: undefined,
      ratio: undefined,
      difficulty: undefined,
      volume: undefined,
      forward: undefined,
      reverse: undefined,
    });
  });

  it('colours by ratio like the pattern charts', () => {
    expect(patternRatioColor('2.92:1')).toBe('red');
    expect(patternRatioColor('5:1')).toBe('#ed8e07');
    expect(patternRatioColor('10:1')).toBe('green');
    expect(patternRatioColor(undefined)).toBe('blue');
  });

  it('adds up a run of bars, clipped to the bars there are', () => {
    const bars = [
      { forward: 1, reverse: 2 },
      { forward: 3, reverse: 4 },
      { forward: 5, reverse: 6 },
    ];
    expect(sumBars(bars, { from: 1, to: 2 })).toEqual({ forward: 8, reverse: 10 });
    expect(sumBars(bars, { from: 2, to: 9 })).toEqual({ forward: 5, reverse: 6 });
  });
});
