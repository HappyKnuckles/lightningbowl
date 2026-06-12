import { Ball } from 'src/app/core/models/ball.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { recommendPatternsForBall } from './ball-patterns.util';

function makeBall(overrides: Partial<Ball>): Ball {
  return {
    availability: '',
    ball_id: 'test',
    ball_image: '',
    ball_name: 'Test Ball',
    brand_id: '',
    brand_name: '',
    core_diff: '0.050',
    core_id: '',
    core_image: '',
    core_int_diff: '',
    core_name: '',
    core_rg: '2.48',
    core_type: '',
    core_weight: '15',
    coverstock_id: '',
    coverstock_name: '',
    coverstock_type: 'Solid Reactive',
    factory_finish: '500 Grit',
    last_update: '',
    release_date: '',
    thumbnail_image: '',
    us_int: '',
    ...overrides,
  };
}

function makePattern(overrides: Partial<Pattern>): Partial<Pattern> {
  return {
    url: overrides.title ?? 'pattern',
    title: 'Pattern',
    category: '',
    ...overrides,
  };
}

describe('recommendPatternsForBall', () => {
  const heavyLong = makePattern({ title: 'Heavy Long', volume: '31', distance: '45', ratio: '3:1' });
  const mediumHouse = makePattern({ title: 'Medium House', volume: '24', distance: '40', ratio: '10:1' });
  const shortLight = makePattern({ title: 'Short Light', volume: '19', distance: '34', ratio: '4:1' });
  const library = [heavyLong, mediumHouse, shortLight];

  it('ranks heavy patterns first for a strong, dull solid ball', () => {
    const strongBall = makeBall({ coverstock_type: 'Solid Reactive', factory_finish: '500 Grit', core_rg: '2.46', core_diff: '0.054' });
    const result = recommendPatternsForBall(strongBall, library);
    expect(result[0].pattern.title).toBe('Heavy Long');
  });

  it('ranks light patterns first for a weak, polished pearl ball', () => {
    const weakBall = makeBall({ coverstock_type: 'Pearl Reactive', factory_finish: 'Polished', core_rg: '2.58', core_diff: '0.030' });
    const result = recommendPatternsForBall(weakBall, library);
    expect(result[0].pattern.title).toBe('Short Light');
  });

  it('explains every recommendation', () => {
    const result = recommendPatternsForBall(makeBall({}), library);
    expect(result.length).toBeGreaterThan(0);
    for (const recommendation of result) {
      expect(recommendation.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns nothing for plastic spare balls', () => {
    const spareBall = makeBall({ coverstock_type: 'Plastic/Polyester' });
    expect(recommendPatternsForBall(spareBall, library)).toEqual([]);
  });

  it('skips patterns without usable data and respects the limit', () => {
    const noData = makePattern({ title: 'No Data' });
    const result = recommendPatternsForBall(makeBall({}), [...library, noData], 2);
    expect(result.length).toBe(2);
    expect(result.some((r) => r.pattern.title === 'No Data')).toBe(false);
  });

  it('renders empty for an empty pattern library', () => {
    expect(recommendPatternsForBall(makeBall({}), [])).toEqual([]);
  });

  describe('with stripped pattern data (title/category/ratio only, like patterns/all-stripped)', () => {
    const sportStripped = makePattern({ title: 'Sport Flat', ratio: '2.5:1' });
    const houseStripped = makePattern({ title: 'Typical House', ratio: '10:1' });

    it('matches strong balls to sport patterns and weak balls to house patterns', () => {
      const strongBall = makeBall({ coverstock_type: 'Solid Reactive', factory_finish: '500 Grit', core_rg: '2.46', core_diff: '0.054' });
      expect(recommendPatternsForBall(strongBall, [sportStripped, houseStripped])[0].pattern.title).toBe('Sport Flat');

      const weakBall = makeBall({ coverstock_type: 'Pearl Reactive', factory_finish: 'Polished', core_rg: '2.58', core_diff: '0.030' });
      expect(recommendPatternsForBall(weakBall, [sportStripped, houseStripped])[0].pattern.title).toBe('Typical House');
    });

    it('prefers more recent patterns when otherwise similar', () => {
      const oldPattern = makePattern({ title: '2003 WTBA World Championships', ratio: '3:1' });
      const newPattern = makePattern({ title: '2024 PBA Tour Finals', ratio: '3:1' });
      const strongBall = makeBall({ coverstock_type: 'Solid Reactive', factory_finish: '500 Grit', core_rg: '2.46', core_diff: '0.054' });
      const result = recommendPatternsForBall(strongBall, [oldPattern, newPattern]);
      expect(result[0].pattern.title).toBe('2024 PBA Tour Finals');
    });

    it('reads the pattern length from a trailing number in the title', () => {
      const longTitled = makePattern({ title: 'Stadium 45', ratio: '3:1' });
      const shortTitled = makePattern({ title: 'Boardwalk 33', ratio: '3:1' });
      const strongBall = makeBall({ coverstock_type: 'Solid Reactive', factory_finish: '500 Grit', core_rg: '2.46', core_diff: '0.054' });
      const result = recommendPatternsForBall(strongBall, [shortTitled, longTitled]);
      expect(result[0].pattern.title).toBe('Stadium 45');
    });
  });
});
