import {
  calculationFacts,
  describeCalculatedRow,
  isBuffingRow,
  newPatternRow,
  parseDecimal,
  PatternDraft,
  toPatternInput,
} from './pattern-input.utils';

const row = (overrides: Partial<ReturnType<typeof newPatternRow>> = {}) => ({ ...newPatternRow(undefined, '45'), ...overrides });

const draft = (overrides: Partial<PatternDraft> = {}): PatternDraft => ({
  title: '',
  pump: '45',
  tanks: '',
  reverseStart: '',
  forward: [row()],
  reverse: [],
  ...overrides,
});

describe('pattern input utils', () => {
  it('reads decimals with a comma or a point', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal(' 14 ')).toBe(14);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('x')).toBeUndefined();
  });

  it('starts a pattern on typical sheet values with mics from the pump', () => {
    expect(newPatternRow(undefined, '40')).toMatchObject({ start: '2L', stop: '2R', load: '2', mics: '40', speed: '14', buf: '3' });
    expect(newPatternRow(undefined, '').mics).toBe('');
  });

  it('continues a new row from the one before, with a new key and no end distance', () => {
    const previous = row({ start: '10L', stop: '10R', load: '3', distanceEnd: '20' });
    const next = newPatternRow(previous, '45');

    expect(next).toMatchObject({ start: '10L', stop: '10R', load: '3', distanceEnd: '' });
    expect(next.key).not.toBe(previous.key);
  });

  it('turns the draft into what the pattern API takes', () => {
    const input = toPatternInput(
      draft({
        title: ' House ',
        tanks: 'KEGEL',
        reverseStart: '37',
        forward: [row({ start: '2l', stop: '2r', mics: '45', buf: '' }), row({ load: '0', mics: '0', speed: '26', distanceEnd: '37,5' })],
        reverse: [row({ start: '9L', stop: '9R', tank: 'A' })],
      }),
    );

    expect(input).toEqual({
      title: 'House',
      pump: '45',
      tanks: 'KEGEL',
      reverse_start: 37,
      forwards_data: [
        { start: '2L', stop: '2R', load: 2, mics: 45, speed: 14 },
        { start: '2L', stop: '2R', load: 0, mics: 0, speed: 26, buf: 3, distance_end: 37.5 },
      ],
      reverse_data: [{ start: '9L', stop: '9R', load: 2, mics: 45, speed: 14, buf: 3, tank: 'A' }],
    });
  });

  it('only sends an end distance for buffing rows', () => {
    const input = toPatternInput(draft({ forward: [row({ distanceEnd: '20' })] }));
    expect(input.forwards_data[0].distance_end).toBeUndefined();
    expect(isBuffingRow(row({ load: '0' }))).toBe(true);
    expect(isBuffingRow(row({ load: '' }))).toBe(false);
  });

  it('describes calculated rows and totals', () => {
    expect(describeCalculatedRow(undefined)).toBe('');
    expect(
      describeCalculatedRow({
        number: '1',
        start: '2L',
        stop: '2R',
        load: '2',
        mics: '45',
        speed: '14',
        buf: '3',
        tank: '',
        total_oil: '3.330',
        distance_start: '0.00',
        distance_end: '1.96',
      }),
    ).toBe('0.00 → 1.96 ft · 3.330 mL');
    expect(
      calculationFacts({ distance: "37'", ratio: '2.92:1', volume: '26.51', forward: '13.64', reverse: '12.87', forwards_data: [], reverse_data: [] }),
    ).toEqual([
      { label: 'Distance', value: '37 ft' },
      { label: 'Ratio', value: '2.92:1' },
      { label: 'Volume', value: '26.51 mL', detail: '↑ 13.64 · ↓ 12.87' },
    ]);
  });
});
