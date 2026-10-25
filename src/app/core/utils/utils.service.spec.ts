import { TestBed } from '@angular/core/testing';

import { UtilsService } from './utils.service';

describe('UtilsService', () => {
  let service: UtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UtilsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateUniqueSeriesId', () => {
    it('prefixes the id and keeps it unique', () => {
      const first = service.generateUniqueSeriesId();
      const second = service.generateUniqueSeriesId();

      expect(first).toMatch(/^series-/);
      expect(first).not.toBe(second);
    });
  });

  describe('transformDate', () => {
    it('formats as zero-padded ISO date', () => {
      expect(service.transformDate(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(service.transformDate(new Date(2026, 10, 25))).toBe('2026-11-25');
    });
  });

  describe('areDatesEqual', () => {
    it('compares only the date part', () => {
      expect(service.areDatesEqual('2026-01-05T10:00:00Z', '2026-01-05T23:59:00Z')).toBe(true);
      expect(service.areDatesEqual('2026-01-05', '2026-01-06')).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('is true for two timestamps on the same calendar day', () => {
      expect(service.isSameDay(new Date(2026, 0, 5, 1).getTime(), new Date(2026, 0, 5, 23).getTime())).toBe(true);
    });

    it('is false across days, months or years', () => {
      expect(service.isSameDay(new Date(2026, 0, 5).getTime(), new Date(2026, 0, 6).getTime())).toBe(false);
      expect(service.isSameDay(new Date(2026, 0, 5).getTime(), new Date(2026, 1, 5).getTime())).toBe(false);
      expect(service.isSameDay(new Date(2026, 0, 5).getTime(), new Date(2025, 0, 5).getTime())).toBe(false);
    });
  });

  describe('isDayBefore', () => {
    it('is true for an earlier day, month or year', () => {
      expect(service.isDayBefore(new Date(2026, 0, 5).getTime(), new Date(2026, 0, 6).getTime())).toBe(true);
      expect(service.isDayBefore(new Date(2026, 0, 31).getTime(), new Date(2026, 1, 1).getTime())).toBe(true);
      expect(service.isDayBefore(new Date(2025, 11, 31).getTime(), new Date(2026, 0, 1).getTime())).toBe(true);
    });

    it('is false for the same day or a later one', () => {
      expect(service.isDayBefore(new Date(2026, 0, 5, 8).getTime(), new Date(2026, 0, 5, 20).getTime())).toBe(false);
      expect(service.isDayBefore(new Date(2026, 0, 6).getTime(), new Date(2026, 0, 5).getTime())).toBe(false);
      expect(service.isDayBefore(new Date(2026, 1, 1).getTime(), new Date(2026, 0, 31).getTime())).toBe(false);
    });
  });

  describe('areArraysEqual', () => {
    it('ignores order', () => {
      expect(service.areArraysEqual(['a', 'b'], ['b', 'a'])).toBe(true);
    });

    it('is false for different lengths or contents', () => {
      expect(service.areArraysEqual(['a'], ['a', 'b'])).toBe(false);
      expect(service.areArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false);
    });

    it('does not mutate the inputs', () => {
      const first = ['b', 'a'];
      service.areArraysEqual(first, ['a', 'b']);

      expect(first).toEqual(['b', 'a']);
    });
  });

  describe('isValidNumber0to10', () => {
    it('accepts a pin count', () => {
      expect(service.isValidNumber0to10(0)).toBe(true);
      expect(service.isValidNumber0to10(10)).toBe(true);
    });

    it('rejects anything outside the pin range', () => {
      expect(service.isValidNumber0to10(-1)).toBe(false);
      expect(service.isValidNumber0to10(11)).toBe(false);
      expect(service.isValidNumber0to10(NaN)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('accepts numeric values and numeric strings', () => {
      expect(service.isNumber(7)).toBe(true);
      expect(service.isNumber('7.5')).toBe(true);
    });

    it('rejects non-numeric input', () => {
      expect(service.isNumber('abc')).toBe(false);
      expect(service.isNumber(undefined)).toBe(false);
      expect(service.isNumber(Infinity)).toBe(false);
    });
  });

  describe('parseIntValue', () => {
    it('parses leading digits', () => {
      expect(service.parseIntValue('42')).toBe(42);
      expect(service.parseIntValue('42abc')).toBe(42);
    });

    it('returns an empty string when nothing parses', () => {
      expect(service.parseIntValue('abc')).toBe('');
    });
  });

  describe('calculateStatDelta', () => {
    it('returns the rounded delta and percentage change', () => {
      expect(service.calculateStatDelta(210, 200)).toEqual({ delta: 10, percent: 5 });
      expect(service.calculateStatDelta(180.555, 200)).toEqual({ delta: -19.44, percent: -9.72 });
    });

    it('has no percentage without a previous value', () => {
      expect(service.calculateStatDelta(210, undefined)).toEqual({ delta: 0, percent: null });
      expect(service.calculateStatDelta(210, 0)).toEqual({ delta: 210, percent: null });
    });
  });

  describe('formatStatDifference', () => {
    it('signs the delta and appends the percentage', () => {
      expect(service.formatStatDifference(210, 200)).toBe('+10.00 (5.00%)');
      expect(service.formatStatDifference(190, 200)).toBe('-10.00 (-5.00%)');
    });

    it('omits the percentage when there is no baseline', () => {
      expect(service.formatStatDifference(210, 0)).toBe('+210.00');
    });

    it('renders an unchanged stat as a plain zero', () => {
      expect(service.formatStatDifference(200, 200)).toBe('0');
    });
  });

  describe('getArrowIcon', () => {
    it('points up or down with the trend', () => {
      expect(service.getArrowIcon(210, 200)).toBe('arrow-up');
      expect(service.getArrowIcon(190, 200)).toBe('arrow-down');
    });

    it('is empty when unchanged or without a comparison', () => {
      expect(service.getArrowIcon(200, 200)).toBe('');
      expect(service.getArrowIcon(200)).toBe('');
      expect(service.getArrowIcon(undefined as unknown as number, 200)).toBe('');
    });
  });

  describe('getDiffColor', () => {
    it('colors improvements success and drops danger', () => {
      expect(service.getDiffColor(210, 200)).toBe('success');
      expect(service.getDiffColor(190, 200)).toBe('danger');
    });

    it('is empty when unchanged or without a comparison', () => {
      expect(service.getDiffColor(200, 200)).toBe('');
      expect(service.getDiffColor(200)).toBe('');
    });
  });
});
