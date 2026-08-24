import { Frame, Throw } from 'src/app/core/models/game.model';
import { makeFrame, makeGame, makeThrow } from 'src/testing/fixtures';
import { getBallTracking, getCarryOverThrowBall, getThrowBallKeys, setThrowBall } from './ball.utils';

function emptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
}

describe('ball.utils', () => {
  describe('setThrowBall', () => {
    it('stores the ball as pendingBall instead of fabricating a throw when none exists yet', () => {
      const frames = emptyFrames();

      setThrowBall(frames, 0, 0, { name: 'Storm IQ Tour', weight: '15' });

      expect(frames[0].throws).toEqual([]);
      expect(frames[0].pendingBall).toEqual({ name: 'Storm IQ Tour', weight: '15' });
    });

    it('sets the ball directly on a throw that already exists', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 6, throwIndex: 1 }];

      setThrowBall(frames, 0, 0, { name: 'Storm IQ Tour', weight: '15' });

      expect(frames[0].throws[0].ball).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(frames[0].pendingBall).toBeUndefined();
    });
  });
});

describe('getBallTracking', () => {
  it('trusts the stored flag', () => {
    expect(getBallTracking({ ballTracking: 'throw', frames: [] })).toBe('throw');
    expect(getBallTracking({ ballTracking: 'game', frames: [] })).toBe('game');
  });

  it('falls back to whether any throw actually carries a ball', () => {
    const withBall = [makeFrame(0, [makeThrow(0, [], { ball: { name: 'IQ Tour', weight: '15' } })])];

    expect(getBallTracking({ frames: withBall })).toBe('throw');
    expect(getBallTracking({ frames: [makeFrame(0, [makeThrow(0, [])])] })).toBe('game');
  });

  it('reads a legacy game with no flag and no per-throw balls as game-tracked', () => {
    expect(getBallTracking(makeGame({ balls: ['IQ Tour15'] }))).toBe('game');
  });
});

describe('getThrowBallKeys', () => {
  it('returns each ball once, in first-use order', () => {
    const iq = { name: 'IQ Tour', weight: '15' };
    const phaze = { name: 'Phaze II', weight: '15' };
    const frames = [
      makeFrame(0, [makeThrow(0, [], { ball: iq })]),
      makeFrame(1, [makeThrow(0, [], { ball: phaze })]),
      makeFrame(2, [makeThrow(0, [], { ball: iq })]),
    ];

    expect(getThrowBallKeys(frames)).toEqual(['IQ Tour15', 'Phaze II15']);
  });

  it('ignores throws with no ball', () => {
    expect(getThrowBallKeys([makeFrame(0, [makeThrow(0, [])])])).toEqual([]);
  });
});

describe('getCarryOverThrowBall', () => {
  const strikeBall = { name: 'IQ Tour', weight: '15' };
  const spareBall = { name: 'White Dot', weight: '15' };

  function framesFrom(entries: { frameIndex: number; throws: Throw[] }[]): Frame[] {
    const frames = emptyFrames();
    for (const entry of entries) {
      frames[entry.frameIndex] = { frameIndex: entry.frameIndex, throws: entry.throws };
    }
    return frames;
  }

  it('carries the first ball to the next first ball', () => {
    const frames = framesFrom([{ frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: strikeBall }] }]);

    expect(getCarryOverThrowBall(frames, 1, 0)).toEqual(strikeBall);
  });

  it('carries the spare ball to the next spare shot rather than the first ball', () => {
    const frames = framesFrom([
      {
        frameIndex: 0,
        throws: [
          { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
          { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
        ],
      },
      { frameIndex: 1, throws: [{ value: 8, throwIndex: 1, pinsLeftStanding: [7, 10], ball: strikeBall }] },
    ]);

    expect(getCarryOverThrowBall(frames, 1, 1)).toEqual(spareBall);
  });

  it('treats every throw of a 10/10/10 tenth frame as a first ball', () => {
    const frames = framesFrom([
      {
        frameIndex: 0,
        throws: [
          { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
          { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
        ],
      },
      { frameIndex: 9, throws: [{ value: 10, throwIndex: 1, ball: strikeBall }] },
    ]);

    // Second throw of the tenth after a strike is a fresh rack, so it wants the first ball.
    expect(getCarryOverThrowBall(frames, 9, 1)).toEqual(strikeBall);

    frames[9].throws.push({ value: 10, throwIndex: 2, ball: strikeBall });
    expect(getCarryOverThrowBall(frames, 9, 2)).toEqual(strikeBall);
  });

  it('wants the spare ball for the tenth frame second throw after an open first ball', () => {
    const frames = framesFrom([
      {
        frameIndex: 0,
        throws: [
          { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
          { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
        ],
      },
      { frameIndex: 9, throws: [{ value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall }] },
    ]);

    expect(getCarryOverThrowBall(frames, 9, 1)).toEqual(spareBall);
  });

  it('wants the first ball again for the tenth frame third throw after a spare', () => {
    const frames = framesFrom([
      { frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: strikeBall }] },
      {
        frameIndex: 9,
        throws: [
          { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
          { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
        ],
      },
    ]);

    expect(getCarryOverThrowBall(frames, 9, 2)).toEqual(strikeBall);
  });

  it('falls back to the last ball used when that kind of throw has not happened yet', () => {
    const frames = framesFrom([{ frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: strikeBall }] }]);

    expect(getCarryOverThrowBall(frames, 0, 1)).toEqual(strikeBall);
  });
});
