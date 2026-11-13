import { Ball } from 'src/app/core/models/ball.model';
import { makeBall } from 'src/testing/fixtures';
import { ballKey, LegacyBall, parseStoredBall, toStoredBall } from './stored-ball.utils';

/** A ball as bowwwl.com's data was saved before the ball API: no key or first_seen_at. */
function makeLegacyBall(overrides: Partial<LegacyBall> = {}): LegacyBall {
  const legacy: Partial<Ball> = makeBall();
  delete legacy.key;
  delete legacy.first_seen_at;
  return { ...(legacy as LegacyBall), ...overrides };
}

describe('toStoredBall', () => {
  it('turns legacy string specs into numbers or null', () => {
    const legacy = makeLegacyBall({ core_rg: '2.50', core_diff: '0,052', core_int_diff: 'n/a' });
    const ball = toStoredBall(legacy);
    expect(ball.core_rg).toBe(2.5);
    expect(ball.core_diff).toBe(0.052);
    expect(ball.core_int_diff).toBeNull();
  });

  it('treats empty and missing specs as unknown', () => {
    const legacy = { ...makeLegacyBall({ core_rg: '' }), core_diff: undefined } as unknown as LegacyBall;
    const ball = toStoredBall(legacy);
    expect(ball.core_rg).toBeNull();
    expect(ball.core_diff).toBeNull();
  });

  it('marks first_seen_at as unknown for balls saved before the ball API', () => {
    expect(toStoredBall(makeLegacyBall()).first_seen_at).toBe('');
  });

  it('returns current balls unchanged', () => {
    const ball = makeBall({ core_rg: 2.5, core_diff: null });
    expect(toStoredBall(ball)).toBe(ball);
  });
});

describe('parseStoredBall', () => {
  it('splits the weight off the name in every stored format', () => {
    for (const value of ['Phaze II15', 'Phaze II 15', 'Phaze II 15lbs', 'Phaze II 15 lb', 'Phaze II 15#']) {
      expect(parseStoredBall(value)).toEqual({ name: 'Phaze II', weight: '15' });
    }
  });

  it('keeps plain names, including names ending in a number that is no ball weight', () => {
    expect(parseStoredBall('Phaze II')).toEqual({ name: 'Phaze II' });
    expect(parseStoredBall('Black Widow 3.0')).toEqual({ name: 'Black Widow 3.0' });
    expect(parseStoredBall('Hy-Road 40')).toEqual({ name: 'Hy-Road 40' });
  });
});

describe('ballKey', () => {
  it("uses the API's key, and builds the same for balls saved without one", () => {
    expect(ballKey({ key: 'abc-15', ball_id: 'x', core_weight: '12' })).toBe('abc-15');
    expect(ballKey({ ball_id: '1234', core_weight: '15' })).toBe('1234-15');
  });

  it('gives balls saved before the key existed their key when they are loaded', () => {
    const saved = makeLegacyBall({ ball_id: '1234', core_weight: '14', core_rg: 2.5, core_diff: 0.05, core_int_diff: 0 });

    expect(toStoredBall(saved).key).toBe('1234-14');
  });

  it('leaves a ball that already has a key as it is', () => {
    const ball = makeBall({ key: '1234-15' });

    expect(toStoredBall(ball)).toBe(ball);
  });
});
