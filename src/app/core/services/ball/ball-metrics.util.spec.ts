import { makeBall } from 'src/testing/fixtures';
import { getBallMetrics, getHookScore, getLengthScore } from './ball-metrics.util';

describe('ball metrics finish parsing', () => {
  const pearl = (factory_finish: string) => makeBall({ coverstock_type: 'Pearl Reactive', factory_finish, core_rg: '2.502', core_diff: '0.051' });

  it('rates a multi-step finish by its last, finest grit', () => {
    // "500, 1000, 1500" ends at 1500 — the same as a plain 1500 finish, not a rough 500.
    expect(getLengthScore(pearl('500, 1000, 1500 Siaair'))).toBe(getLengthScore(pearl('1500 Siaair')));
    expect(getHookScore(pearl('500, 1000, 1500 Siaair'))).toBe(getHookScore(pearl('1500 Siaair')));
  });

  it.each(['500, 1000, 1500 Siaair / Crown Factory Compound', 'Power Edge', '5500 LSP', '1500 Polished', 'Reacta Shine'])(
    'treats "%s" as polished',
    (finish) => {
      expect(getLengthScore(pearl(finish))).toBeGreaterThan(getLengthScore(pearl('1500 Siaair')));
    },
  );

  it.each(['5000 LSS', '3000 Abralon', '2000 Grit Sanded'])('treats "%s" as sanded', (finish) => {
    expect(getHookScore(pearl(finish))).toBeGreaterThanOrEqual(getHookScore(pearl('Power Edge')));
  });
});

describe('ball metrics roll labels', () => {
  it('calls a polished pearl on a low-RG core a late roll', () => {
    const combat = makeBall({
      coverstock_type: 'Pearl Reactive',
      factory_finish: '500, 1000, 1500 Siaair/Crown Factory Compound',
      core_rg: '2.502',
      core_diff: '0.051',
    });

    expect(getBallMetrics(combat).lengthLabel).toBe('Late Roll');
  });

  it('still calls a sanded solid on a low-RG core an early roll', () => {
    const solid = makeBall({ coverstock_type: 'Solid Reactive', factory_finish: '2000 Abralon', core_rg: '2.48', core_diff: '0.05' });

    expect(getBallMetrics(solid).lengthLabel).toBe('Early Roll');
  });
});
