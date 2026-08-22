import { buildSearchSuggestions } from './suggestion.utils';

describe('buildSearchSuggestions', () => {
  const names = ['Phaze II', 'Phaze 4', 'Hammer Phaze', 'Zen', 'Zen Master', 'IQ Tour'];

  it('returns nothing for terms shorter than two characters', () => {
    expect(buildSearchSuggestions(names, '')).toEqual([]);
    expect(buildSearchSuggestions(names, 'p')).toEqual([]);
    expect(buildSearchSuggestions(names, '  z  ')).toEqual([]);
  });

  it('ranks names starting with the term before names merely containing it', () => {
    expect(buildSearchSuggestions(names, 'phaze')).toEqual(['Phaze II', 'Phaze 4', 'Hammer Phaze']);
  });

  it('matches case-insensitively and trims the term', () => {
    expect(buildSearchSuggestions(names, '  ZEN ')).toEqual(['Zen', 'Zen Master']);
  });

  it('drops duplicate names case-insensitively, keeping the first spelling', () => {
    expect(buildSearchSuggestions(['Zen', 'ZEN', 'zen'], 'ze')).toEqual(['Zen']);
  });

  it('skips undefined names', () => {
    expect(buildSearchSuggestions([undefined, 'Zen', undefined], 'ze')).toEqual(['Zen']);
  });

  it('caps the result at the limit', () => {
    const many = ['Zen 1', 'Zen 2', 'Zen 3', 'Zen 4', 'Zen 5', 'Zen 6', 'Zen 7'];

    expect(buildSearchSuggestions(many, 'zen').length).toBe(6);
    expect(buildSearchSuggestions(many, 'zen', 2)).toEqual(['Zen 1', 'Zen 2']);
  });

  it('never lets contains-matches push the total above the limit', () => {
    const mixed = ['A Zen', 'B Zen', 'Zen 1', 'Zen 2', 'Zen 3'];

    const result = buildSearchSuggestions(mixed, 'zen', 4);

    expect(result).toEqual(['Zen 1', 'Zen 2', 'Zen 3', 'A Zen']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(buildSearchSuggestions(names, 'xyz')).toEqual([]);
  });
});
