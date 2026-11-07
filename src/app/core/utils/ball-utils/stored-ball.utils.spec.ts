import { Ball } from 'src/app/core/models/ball.model';
import { makeBall } from 'src/testing/fixtures';
import { ballKey, parseStoredBall, toStoredBall, withBallKeys } from './stored-ball.utils';

describe('toStoredBall', () => {
  it('turns legacy string specs into numbers or null', () => {
    const legacy = { ...makeBall(), core_rg: '2.50', core_diff: '0,052', core_int_diff: 'n/a' } as unknown as Ball;
    const ball = toStoredBall(legacy);
    expect(ball.core_rg).toBe(2.5);
    expect(ball.core_diff).toBe(0.052);
    expect(ball.core_int_diff).toBeNull();
  });

  it('treats empty and missing specs as unknown', () => {
    const legacy = { ...makeBall(), core_rg: '', core_diff: undefined } as unknown as Ball;
    const ball = toStoredBall(legacy);
    expect(ball.core_rg).toBeNull();
    expect(ball.core_diff).toBeNull();
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
    const saved: Partial<Ball> = makeBall({ ball_id: '1234', core_weight: '14', core_rg: 2.5, core_diff: 0.05, core_int_diff: 0 });
    delete saved.key;

    expect(toStoredBall(saved as Ball).key).toBe('1234-14');
  });

  it('leaves a ball that already has a key as it is', () => {
    const ball = makeBall({ key: '1234-15' });

    expect(toStoredBall(ball)).toBe(ball);
  });
});

describe('withBallKeys', () => {
  it('fills in missing keys and keeps the ones the API sent', () => {
    const sent = makeBall({ key: 'abc-15' });
    const missing: Partial<Ball> = makeBall({ ball_id: '1234', core_weight: '14' });
    delete missing.key;

    const [first, second] = withBallKeys([sent, missing as Ball]);

    expect(first).toBe(sent);
    expect(second.key).toBe('1234-14');
  });
});
