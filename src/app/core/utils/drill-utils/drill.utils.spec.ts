import {
  compact,
  formatBowlerFit,
  formatHoleSizes,
  formatInches,
  formatLayout,
  formatPap,
  formatSpan,
  isCompleteLayout,
  isSameLayout,
  LAYOUT_PRESETS,
  parseDegrees,
  parseInches,
  parsePapVertical,
} from './drill.utils';

describe('drill utils', () => {
  describe('isCompleteLayout', () => {
    it('needs every value of the layout system', () => {
      expect(isCompleteLayout({ system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 })).toBe(true);
      expect(isCompleteLayout({ system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5 })).toBe(false);
      expect(isCompleteLayout({ system: 'vls', pinToPap: 5, psaToPap: 4, pinBuffer: 2 })).toBe(true);
      expect(isCompleteLayout({ system: 'vls', pinToPap: 5 })).toBe(false);
    });
  });

  describe('isSameLayout', () => {
    it('compares system and values as written on a drill sheet', () => {
      expect(
        isSameLayout({ system: 'vls', pinToPap: 5, psaToPap: 4, pinBuffer: 2 }, { system: 'vls', pinToPap: 5.001, psaToPap: 4, pinBuffer: 2 }),
      ).toBe(true);
      expect(isSameLayout({ system: 'vls', pinToPap: 5, psaToPap: 4, pinBuffer: 2 }, { system: 'vls', pinToPap: 4, psaToPap: 4, pinBuffer: 2 })).toBe(
        false,
      );
      expect(isSameLayout({ system: 'vls', pinToPap: 4.5 }, { system: 'dual-angle', pinToPap: 4.5 })).toBe(false);
    });
  });

  describe('LAYOUT_PRESETS', () => {
    it('are fully specified for their system', () => {
      for (const preset of LAYOUT_PRESETS) {
        expect(formatLayout(preset)).not.toContain('?');
      }
    });
  });

  describe('parseInches', () => {
    it('returns undefined for empty input', () => {
      expect(parseInches('')).toBeUndefined();
      expect(parseInches('   ')).toBeUndefined();
      expect(parseInches(null)).toBeUndefined();
      expect(parseInches(undefined)).toBeUndefined();
    });

    it('parses whole numbers and decimals with dot or comma', () => {
      expect(parseInches('4')).toBe(4);
      expect(parseInches('4.5')).toBe(4.5);
      expect(parseInches('4,5')).toBe(4.5);
      expect(parseInches('.75')).toBe(0.75);
      expect(parseInches(4.25)).toBe(4.25);
    });

    it('parses fractions the way drill sheets write them', () => {
      expect(parseInches('4 1/2')).toBe(4.5);
      expect(parseInches('4-1/2')).toBe(4.5);
      expect(parseInches('41/64')).toBe(41 / 64);
      expect(parseInches('1 1/64')).toBe(1 + 1 / 64);
      expect(parseInches('4½')).toBe(4.5);
      expect(parseInches('⅛')).toBe(0.125);
    });

    it('ignores inch suffixes', () => {
      expect(parseInches('4 1/2"')).toBe(4.5);
      expect(parseInches('5 in')).toBe(5);
      expect(parseInches('5 inches')).toBe(5);
    });

    it('keeps a leading minus', () => {
      expect(parseInches('-1/2')).toBe(-0.5);
    });

    it('returns NaN for unreadable input', () => {
      expect(parseInches('abc')).toBeNaN();
      expect(parseInches('4/0')).toBeNaN();
      expect(parseInches('4 1/2 3')).toBeNaN();
    });
  });

  describe('parsePapVertical', () => {
    it('treats up as positive and down as negative', () => {
      expect(parsePapVertical('3/4 up')).toBe(0.75);
      expect(parsePapVertical('1/2 down')).toBe(-0.5);
      expect(parsePapVertical('1 1/4" UP')).toBe(1.25);
    });

    it('accepts signed numbers and 0 for the midline', () => {
      expect(parsePapVertical('0')).toBe(0);
      expect(parsePapVertical('-0.5')).toBe(-0.5);
    });

    it('rejects a negative value combined with a direction', () => {
      expect(parsePapVertical('-1 up')).toBeNaN();
    });
  });

  describe('parseDegrees', () => {
    it('accepts an optional degree sign', () => {
      expect(parseDegrees('45°')).toBe(45);
      expect(parseDegrees('47.5')).toBe(47.5);
    });
  });

  describe('formatInches', () => {
    it('writes reduced fractions rounded to 64ths', () => {
      expect(formatInches(4.5)).toBe('4 1/2');
      expect(formatInches(0.75)).toBe('3/4');
      expect(formatInches(41 / 64)).toBe('41/64');
      expect(formatInches(4)).toBe('4');
      expect(formatInches(4.33)).toBe('4 21/64');
      expect(formatInches(-0.5)).toBe('-1/2');
    });

    it('returns an empty string for missing values', () => {
      expect(formatInches(undefined)).toBe('');
      expect(formatInches(Number.NaN)).toBe('');
    });

    it('round-trips through parseInches', () => {
      for (const value of [0.125, 4.5, 41 / 64, 5.25, 1 + 1 / 64]) {
        expect(parseInches(formatInches(value))).toBe(value);
      }
    });
  });

  describe('formatLayout', () => {
    it('writes dual angle as angle × distance × angle', () => {
      expect(formatLayout({ system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 })).toBe('45° × 4 1/2" × 30°');
    });

    it('writes VLS / 2LS as three distances', () => {
      expect(formatLayout({ system: 'vls', pinToPap: 5, psaToPap: 4, pinBuffer: 2 })).toBe('5" × 4" × 2"');
    });

    it('marks missing parts and is empty when nothing is set', () => {
      expect(formatLayout({ system: 'vls', pinToPap: 5 })).toBe('5" × ? × ?');
      expect(formatLayout({ system: 'dual-angle' })).toBe('');
      expect(formatLayout(undefined)).toBe('');
    });
  });

  describe('bowler fit', () => {
    it('writes the PAP as over and up/down', () => {
      expect(formatPap({ papOver: 5.25, papVertical: 0.75 })).toBe('5 1/4" over, 3/4" up');
      expect(formatPap({ papOver: 6, papVertical: -2 })).toBe('6" over, 2" down');
      expect(formatPap({ papOver: 3, papVertical: 0 })).toBe('3" over, 0"');
      expect(formatPap({})).toBe('');
    });

    it('writes the span as middle / ring', () => {
      expect(formatSpan({ middleSpan: 4.125, ringSpan: 4.25 })).toBe('4 1/8" / 4 1/4"');
      expect(formatSpan({ ringSpan: 4.25 })).toBe('4 1/4"');
    });

    it('summarizes grip, span and PAP in one line', () => {
      expect(formatBowlerFit({ grip: 'fingertip', middleSpan: 4.125, ringSpan: 4.25, papOver: 5.25, papVertical: 0.75 })).toBe(
        'Fingertip · Span 4 1/8" / 4 1/4" · PAP 5 1/4" over, 3/4" up',
      );
      expect(formatBowlerFit(undefined)).toBe('');
    });

    it('leaves out grip and span for two-handers', () => {
      expect(formatBowlerFit({ style: 'two-handed', grip: 'fingertip', middleSpan: 4, papOver: 5, papVertical: 0.5 })).toBe(
        'Two-Handed · PAP 5" over, 1/2" up',
      );
    });
  });

  describe('compact', () => {
    it('drops undefined and empty fields and returns undefined when nothing is left', () => {
      expect(compact({ a: 1, b: undefined, c: '' })).toEqual({ a: 1 } as never);
      expect(compact({ a: undefined })).toBeUndefined();
    });

    it('keeps zero', () => {
      expect(compact({ papVertical: 0 })).toEqual({ papVertical: 0 });
    });
  });

  describe('formatHoleSizes', () => {
    it('lists the set holes as a compact tag', () => {
      expect(formatHoleSizes({ thumbSize: 63 / 64, middleFingerSize: 41 / 64, ringFingerSize: 39 / 64 })).toBe('T 63/64 · M 41/64 · R 39/64');
      expect(formatHoleSizes({ middleFingerSize: 41 / 64 })).toBe('M 41/64');
    });

    it('leaves out the thumb for two-handers and is empty when nothing is set', () => {
      expect(formatHoleSizes({ thumbSize: 1, middleFingerSize: 0.625 }, true)).toBe('M 5/8');
      expect(formatHoleSizes({ layout: { system: 'vls', pinToPap: 5 } })).toBe('');
      expect(formatHoleSizes(undefined)).toBe('');
    });
  });
});
