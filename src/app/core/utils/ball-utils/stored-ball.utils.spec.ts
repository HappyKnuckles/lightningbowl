import { Ball } from 'src/app/core/models/ball.model';
import { makeBall } from 'src/testing/fixtures';
import { formatStoredBall, parseStoredBall, toStoredBall } from './stored-ball.utils';

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

describe('parseStoredBall / formatStoredBall', () => {
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

  it('formats as "Name 15lbs", or the plain name without a weight', () => {
    expect(formatStoredBall({ name: 'Phaze II', weight: '15' })).toBe('Phaze II 15lbs');
    expect(formatStoredBall({ name: 'Phaze II' })).toBe('Phaze II');
  });
});
