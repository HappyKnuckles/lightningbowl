import { formatOpeningHours, getOpenState } from './opening-hours.util';

describe('opening-hours util', () => {
  // 2026-06-10 is a Wednesday
  const wednesdayAt = (hours: number, minutes = 0): Date => new Date(2026, 5, 10, hours, minutes);

  it('returns unknown when no hours are provided', () => {
    expect(getOpenState(undefined)).toBe('unknown');
  });

  it('handles 24/7', () => {
    expect(getOpenState('24/7', wednesdayAt(3))).toBe('open');
  });

  it('evaluates day ranges with time ranges', () => {
    expect(getOpenState('Mo-Fr 14:00-23:00', wednesdayAt(15))).toBe('open');
    expect(getOpenState('Mo-Fr 14:00-23:00', wednesdayAt(10))).toBe('closed');
    expect(getOpenState('Sa-Su 12:00-23:00', wednesdayAt(15))).toBe('closed');
  });

  it('evaluates day lists and multiple rules', () => {
    expect(getOpenState('Mo,We 10:00-22:00; Sa,Su 12:00-20:00', wednesdayAt(11))).toBe('open');
    expect(getOpenState('Mo-Su 10:00-22:00; We off', wednesdayAt(11))).toBe('closed');
  });

  it('handles ranges crossing midnight', () => {
    // Tuesday 20:00 - 02:00 keeps Wednesday 01:00 open
    expect(getOpenState('Tu 20:00-02:00', wednesdayAt(1))).toBe('open');
    expect(getOpenState('Tu 20:00-02:00', wednesdayAt(3))).toBe('closed');
  });

  it('returns unknown for unsupported syntax', () => {
    expect(getOpenState('sunrise-sunset', wednesdayAt(12))).toBe('unknown');
  });

  it('splits hours into display lines', () => {
    expect(formatOpeningHours('Mo-Fr 14:00-23:00; Sa,Su 12:00-24:00')).toEqual(['Mo-Fr 14:00-23:00', 'Sa,Su 12:00-24:00']);
  });
});
