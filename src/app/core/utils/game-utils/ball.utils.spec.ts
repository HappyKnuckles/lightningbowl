import { Frame, Game, Throw } from 'src/app/core/models/game.model';
import { makeBall, makeFrame, makeGame, makeThrow } from 'src/testing/fixtures';
import {
  migrateGameBalls,
  toGameBall,
  weightFromArsenal,
  canonicalBallKey,
  clearThrowBalls,
  countThrowBalls,
  getBallTracking,
  resolveBallTracking,
  getCarryOverThrowBall,
  getGameBallLabels,
  getGameBallNames,
  getGameBalls,
  getPendingBall,
  getThrowBallForPosition,
  getThrowBallKeys,
  keepArsenalThrowBalls,
  setThrowBall,
} from './ball.utils';

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

    it('stores an explicit clear as null, not undefined, when the throw has not been recorded yet', () => {
      const frames = emptyFrames();

      setThrowBall(frames, 0, 0, undefined);

      expect(frames[0].pendingBall).toBeNull();
    });

    it('remembers which throw the pick was made for', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 6, throwIndex: 1 }];

      setThrowBall(frames, 0, 1, { name: 'Storm IQ Tour', weight: '15' });

      expect(frames[0].pendingBallThrowIndex).toBe(1);
    });
  });

  describe('getPendingBall', () => {
    it('answers only for the throw the pick was made for', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 6, throwIndex: 1 }];
      setThrowBall(frames, 0, 1, { name: 'Storm IQ Tour', weight: '15' });

      expect(getPendingBall(frames[0], 1)).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(getPendingBall(frames[0], 0)).toBeUndefined();
    });

    it('applies to any throw for a pick stored before picks were throw-scoped', () => {
      const frames = emptyFrames();
      frames[0].pendingBall = { name: 'Storm IQ Tour', weight: '15' };

      expect(getPendingBall(frames[0], 0)).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(getPendingBall(frames[0], 1)).toEqual({ name: 'Storm IQ Tour', weight: '15' });
    });
  });

  describe('getThrowBallForPosition', () => {
    it('prefers what a recorded throw was bowled with, absence included', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 6, throwIndex: 1, ball: { name: 'Phaze II', weight: '15' } }];
      frames[1].throws = [{ value: 6, throwIndex: 1 }];

      expect(getThrowBallForPosition(frames, 0, 0)).toEqual({ name: 'Phaze II', weight: '15' });
      expect(getThrowBallForPosition(frames, 1, 0)).toBeUndefined();
    });

    it('falls back to the pick waiting for that throw, then to the carry-over', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 10, throwIndex: 1, ball: { name: 'Phaze II', weight: '15' } }];
      setThrowBall(frames, 1, 0, { name: 'Storm IQ Tour', weight: '15' });

      expect(getThrowBallForPosition(frames, 1, 0)).toEqual({ name: 'Storm IQ Tour', weight: '15' });
      expect(getThrowBallForPosition(frames, 2, 0)).toEqual({ name: 'Phaze II', weight: '15' });
    });

    it('keeps a deliberate clear clear instead of carrying a ball over', () => {
      const frames = emptyFrames();
      frames[0].throws = [{ value: 10, throwIndex: 1, ball: { name: 'Phaze II', weight: '15' } }];
      setThrowBall(frames, 1, 0, undefined);

      expect(getThrowBallForPosition(frames, 1, 0)).toBeUndefined();
    });
  });

  describe('canonicalBallKey', () => {
    const arsenal = [{ ball_name: 'Rocket A.I.', core_weight: '15' }];

    it('reduces the stored formats of one ball to a single key', () => {
      const key = canonicalBallKey('Rocket A.I.15', arsenal);

      expect(canonicalBallKey('Rocket A.I.', arsenal)).toBe(key);
      expect(canonicalBallKey('Rocket A.I. 15lbs', arsenal)).toBe(key);
    });

    it('still compares a ball outside the arsenal against itself', () => {
      expect(canonicalBallKey('Zen U', [])).toBe(canonicalBallKey('zen u', []));
      expect(canonicalBallKey('Zen U', [])).not.toBe(canonicalBallKey('Zen Master', []));
    });
  });

  describe('getGameBallLabels', () => {
    it('shows each ball with its weight, telling two weights of one ball apart', () => {
      const game = makeGame({
        balls: [
          { name: 'Phaze', weight: '14' },
          { name: 'Phaze', weight: '15' },
        ],
      });

      expect(getGameBallLabels(game)).toEqual(['Phaze 14lbs', 'Phaze 15lbs']);
      expect(getGameBallNames(game)).toEqual(['Phaze']);
    });

    it('reads the throws on a throw-tracked game', () => {
      const game = makeGame({
        ballTracking: 'throw',
        frames: [
          makeFrame(0, [
            makeThrow(0, [10], { ball: { name: 'Phaze', weight: '15' } }),
            makeThrow(1, [], { available: [10], ball: { name: 'Spare', weight: '14' } }),
          ]),
        ],
      });

      expect(getGameBallLabels(game)).toEqual(['Phaze 15lbs', 'Spare 14lbs']);
    });
  });

  describe('getGameBallNames', () => {
    it("lists the game's ball names without their weights", () => {
      const game = makeGame({
        balls: [
          { name: 'Rocket A.I.', weight: '15' },
          { name: 'Zen U', weight: '14' },
        ],
      });

      expect(getGameBallNames(game)).toEqual(['Rocket A.I.', 'Zen U']);
    });

    it('reads the selection, not leftover throw balls, on a game-tracked game', () => {
      const game = makeGame({
        ballTracking: 'game',
        balls: [{ name: 'Rocket A.I.', weight: '15' }],
        frames: [makeFrame(0, [makeThrow(0, [], { ball: { name: 'Phaze II', weight: '15' } })])],
      });

      expect(getGameBallNames(game)).toEqual(['Rocket A.I.']);
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
    expect(getBallTracking(makeGame({ balls: [{ name: 'IQ Tour', weight: '15' }] }))).toBe('game');
  });
});

describe('resolveBallTracking', () => {
  const withThrowBall = () => [makeFrame(0, [makeThrow(0, [], { ball: { name: 'IQ Tour', weight: '15' } })])];

  it('follows the default for a game without ball data, even one flagged before', () => {
    expect(resolveBallTracking({ frames: [], balls: [] }, 'throw')).toBe('throw');
    // closing the game's ball picker with nothing picked flags it 'game' without adding data
    expect(resolveBallTracking({ ballTracking: 'game', frames: [], balls: [] }, 'throw')).toBe('throw');
    expect(resolveBallTracking({ ballTracking: 'throw', frames: [], balls: [] }, 'game')).toBe('game');
  });

  it('keeps the mode of a game that carries ball data', () => {
    expect(resolveBallTracking({ ballTracking: 'game', frames: [], balls: [{ name: 'IQ Tour', weight: '15' }] }, 'throw')).toBe('game');
    expect(resolveBallTracking({ ballTracking: 'throw', frames: withThrowBall(), balls: [] }, 'game')).toBe('throw');
  });

  it('reads the mode from the data when the game has no flag', () => {
    expect(resolveBallTracking({ frames: withThrowBall(), balls: [] }, 'game')).toBe('throw');
    expect(resolveBallTracking({ frames: [], balls: [{ name: 'IQ Tour', weight: '15' }] }, 'throw')).toBe('game');
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

  describe('across games', () => {
    const otherBall = { name: 'Phaze II', weight: '15' };
    // Previous game ending on a 9-1 spare: strike ball for first balls, spare ball for the spare.
    const previousGame = (): Frame[] =>
      framesFrom([
        { frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: otherBall }] },
        {
          frameIndex: 9,
          throws: [
            { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
            { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
            { value: 10, throwIndex: 3, ball: strikeBall },
          ],
        },
      ]);

    it('starts a new game on the first ball the previous game ended on', () => {
      expect(getCarryOverThrowBall(emptyFrames(), 0, 0, [previousGame()])).toEqual(strikeBall);
    });

    it("takes the previous game's spare ball for the first spare shot, not this game's strike ball", () => {
      const frames = framesFrom([{ frameIndex: 0, throws: [{ value: 7, throwIndex: 1, pinsLeftStanding: [4, 7, 10], ball: strikeBall }] }]);

      expect(getCarryOverThrowBall(frames, 0, 1, [previousGame()])).toEqual(spareBall);
    });

    it("prefers this game's own picks over earlier games", () => {
      const frames = framesFrom([{ frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: otherBall }] }]);

      expect(getCarryOverThrowBall(frames, 1, 0, [previousGame()])).toEqual(otherBall);
    });

    it('uses the most recent earlier game', () => {
      const lastGame = framesFrom([{ frameIndex: 0, throws: [{ value: 10, throwIndex: 1, ball: otherBall }] }]);

      expect(getCarryOverThrowBall(emptyFrames(), 0, 0, [previousGame(), lastGame])).toEqual(otherBall);
    });

    it('is shown for an untouched throw by getThrowBallForPosition', () => {
      expect(getThrowBallForPosition(emptyFrames(), 0, 0, [previousGame()])).toEqual(strikeBall);
    });
  });

  describe('keepArsenalThrowBalls', () => {
    it('drops balls that are no longer in the arsenal without touching the input', () => {
      const frames = framesFrom([
        {
          frameIndex: 0,
          throws: [
            { value: 9, throwIndex: 1, pinsLeftStanding: [10], ball: strikeBall },
            { value: 1, throwIndex: 2, pinsLeftStanding: [], ball: spareBall },
          ],
        },
      ]);

      const kept = keepArsenalThrowBalls(frames, [{ ball_name: 'White Dot', core_weight: '15' }]);

      expect(kept[0].throws.map((t) => t.ball)).toEqual([undefined, spareBall]);
      expect(frames[0].throws[0].ball).toEqual(strikeBall);
    });
  });
});

describe('getGameBalls', () => {
  const throwFrames = () => [makeFrame(0, [makeThrow(0, [], { ball: { name: 'Phaze II', weight: '15' } })])];

  it('reads the throws of a throw-tracked game', () => {
    expect(getGameBalls(makeGame({ ballTracking: 'throw', balls: [{ name: 'Hammer', weight: '15' }], frames: throwFrames() }))).toEqual([
      'Phaze II15',
    ]);
  });

  it('reads the selection of a game-tracked game, ignoring balls left on its throws', () => {
    expect(getGameBalls(makeGame({ ballTracking: 'game', balls: [{ name: 'Hammer', weight: '15' }], frames: throwFrames() }))).toEqual(['Hammer15']);
  });

  it('derives the mode of an untagged game from its throws', () => {
    expect(getGameBalls(makeGame({ balls: [{ name: 'Hammer', weight: '15' }], frames: throwFrames() }))).toEqual(['Phaze II15']);
    expect(getGameBalls(makeGame({ balls: [{ name: 'Hammer', weight: '15' }] }))).toEqual(['Hammer15']);
  });
});

describe('countThrowBalls / clearThrowBalls', () => {
  const frames = (): Frame[] => [
    makeFrame(0, [makeThrow(0, [10], { ball: { name: 'Phaze II' } }), makeThrow(1, [], { available: [10], ball: { name: 'Spare' } })]),
    { ...makeFrame(1, [makeThrow(0, [])]), pendingBall: { name: 'Phaze II' }, pendingBallThrowIndex: 1 },
  ];

  it('counts recorded throws carrying a ball, not pending picks', () => {
    expect(countThrowBalls(frames())).toBe(2);
  });

  it('strips every throw ball and pending pick', () => {
    const cleared = frames();

    clearThrowBalls(cleared);

    expect(countThrowBalls(cleared)).toBe(0);
    expect(cleared[1].pendingBall).toBeUndefined();
    expect(cleared[1].pendingBallThrowIndex).toBeUndefined();
    expect(cleared[0].throws.map((t) => t.value)).toEqual([9, 1]);
  });
});

describe('weightFromArsenal', () => {
  const arsenal = [
    makeBall({ ball_name: 'Phaze', core_weight: '14' }),
    makeBall({ ball_name: 'Phaze', core_weight: '15' }),
    makeBall({ ball_name: 'Zen', core_weight: '13' }),
  ];

  it("takes the arsenal's weight for the name, the heaviest when it holds several", () => {
    expect(weightFromArsenal('Zen', arsenal)).toBe('13');
    expect(weightFromArsenal('phaze', arsenal)).toBe('15');
  });

  it('falls back to 15 for a ball the arsenal lacks', () => {
    expect(weightFromArsenal('Hammer', arsenal)).toBe('15');
  });
});

describe('toGameBall', () => {
  const arsenal = [makeBall({ ball_name: 'Phaze', core_weight: '14' }), makeBall({ ball_name: 'Black Widow 3.0', core_weight: '12' })];

  it('keeps a stored weight in any format', () => {
    expect(toGameBall('Phaze 15lbs', arsenal)).toEqual({ name: 'Phaze', weight: '15' });
    expect(toGameBall('Phaze15', arsenal)).toEqual({ name: 'Phaze', weight: '15' });
    expect(toGameBall({ name: 'Phaze', weight: '16' }, arsenal)).toEqual({ name: 'Phaze', weight: '16' });
  });

  it('gives a name alone the weight from the arsenal', () => {
    expect(toGameBall('Phaze', arsenal)).toEqual({ name: 'Phaze', weight: '14' });
    expect(toGameBall({ name: 'Phaze' }, arsenal)).toEqual({ name: 'Phaze', weight: '14' });
    expect(toGameBall('Hammer', arsenal)).toEqual({ name: 'Hammer', weight: '15' });
  });

  it('does not split a number off a name the arsenal knows', () => {
    expect(toGameBall('Black Widow 3.0', arsenal)).toEqual({ name: 'Black Widow 3.0', weight: '12' });
  });
});

describe('migrateGameBalls', () => {
  const arsenal = [makeBall({ ball_name: 'Phaze', core_weight: '14' }), makeBall({ ball_name: 'Phaze', core_weight: '15' })];

  it('turns stored strings into balls with a weight, once each', () => {
    const game = { ...makeGame(), balls: ['Phaze 15lbs', 'Phaze'] } as unknown as Game;

    expect(migrateGameBalls(game, arsenal).balls).toEqual([{ name: 'Phaze', weight: '15' }]);
  });

  it('gives throw balls without a weight one, and leaves the rest alone', () => {
    const game = makeGame({
      frames: [makeFrame(0, [makeThrow(1, [7], { ball: { name: 'Phaze' } }), makeThrow(2, [], { ball: { name: 'Spare', weight: '12' } })])],
    });

    const migrated = migrateGameBalls(game, [makeBall({ ball_name: 'Phaze', core_weight: '14' })]);

    expect(migrated.frames[0].throws[0].ball).toEqual({ name: 'Phaze', weight: '14' });
    expect(migrated.frames[0].throws[1]).toBe(game.frames[0].throws[1]);
  });

  it('returns the same game when every ball has a weight', () => {
    const game = makeGame({ balls: [{ name: 'Phaze', weight: '15' }] });

    expect(migrateGameBalls(game, arsenal)).toBe(game);
  });
});
