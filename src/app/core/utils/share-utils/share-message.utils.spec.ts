import { makeBall, makeGame } from 'src/testing/fixtures';

import { buildBallShareMessage, buildGameShareMessage } from './share-message.utils';

describe('buildGameShareMessage', () => {
  it('names score and date', () => {
    expect(buildGameShareMessage(makeGame({ totalScore: 212 }), 'en-US')).toBe('Check out this game from 01.01.26. A 212.');
  });

  it('celebrates a perfect game and lists the patterns', () => {
    const message = buildGameShareMessage(makeGame({ totalScore: 300, patterns: ['Kegel Main Street', 'PBA Cheetah'] }), 'en-US');
    expect(message).toBe('Look at me bitches, perfect game on 01.01.26! 🎳🎉.\nPatterns: Kegel Main Street, PBA Cheetah');
  });
});

describe('buildBallShareMessage', () => {
  it('describes the ball with core and coverstock', () => {
    const ball = makeBall({ ball_name: 'Phaze II', brand_name: 'Storm', release_date: '2016', core_int_diff: 0.017 });
    expect(buildBallShareMessage(ball)).toBe(
      [
        'Check out the Phaze II by Storm (2016) 🎳',
        'Core: Test Core, Symmetric, RG 2.5, Diff 0.045, Int. Diff 0.017',
        'Coverstock: Test Coverstock, Reactive, 500 Siaair',
      ].join('\n'),
    );
  });

  it('adds weight and layout for a ball from the arsenal', () => {
    const ball = makeBall({
      ball_name: 'Phaze II',
      brand_name: 'Storm',
      release_date: null,
      drilling: { layout: { system: 'dual-angle', drillingAngle: 45, pinToPap: 4.5, valAngle: 30 } },
    });
    const message = buildBallShareMessage(ball, true).split('\n');
    expect(message[0]).toBe('In my bag: Phaze II by Storm 🎳');
    expect(message[1]).toBe('Weight: 15 lbs');
    expect(message[2]).toMatch(/^Layout: Dual Angle 45° × 4 1\/2" × 30°$/);
  });

  it('leaves out what the ball has no data for', () => {
    const ball = makeBall({
      brand_name: null,
      release_date: null,
      core_name: null,
      core_type: null,
      core_rg: null,
      core_diff: null,
      core_int_diff: null,
      coverstock_name: null,
      coverstock_type: null,
      factory_finish: null,
    });
    expect(buildBallShareMessage(ball)).toBe('Check out the Test Ball 🎳');
  });
});
