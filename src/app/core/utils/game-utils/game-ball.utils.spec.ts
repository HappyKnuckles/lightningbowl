import { Frame, Game, Throw } from 'src/app/core/models/game.model';
import { makeBall, makeFrame, makeGame, makeThrow } from 'src/testing/fixtures';
import {
  migrateGameBalls,
  toGameBall,
  weightFromArsenal,
  findBall,
  sameGameBall,
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
  parseStoredBall,
  setThrowBall,
  fromBallFilterValue,
  getBallModelKey,
  getThrowBallKey,
  getThrowBalls,
  toThrowBall,
  unlinkArsenalBall,
  usesArsenalBall,
  withBallLayouts,
} from './game-ball.utils';

function emptyFrames(): Frame[] {
  return Array.from({ length: 10 }, (_, i) => ({ frameIndex: i + 1, throws: [] }));
}

describe('game-ball.utils', () => {
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

  describe('findBall / sameGameBall', () => {
    const arsenal = [makeBall({ ball_name: 'Rocket A.I.', core_weight: '14' }), makeBall({ ball_name: 'Rocket A.I.', core_weight: '15' })];

    it('finds the ball in the same weight', () => {
      expect(findBall({ name: 'Rocket A.I.', weight: '15' }, arsenal)).toBe(arsenal[1]);
      expect(findBall({ name: 'Rocket A.I.', weight: '16' }, arsenal)).toBeUndefined();
      expect(findBall(undefined, arsenal)).toBeUndefined();
    });

    it('compares exactly, since migrated games hold canonical balls', () => {
      expect(sameGameBall({ name: 'Zen U', weight: '15' }, { name: 'Zen U', weight: '15' })).toBe(true);
      expect(sameGameBall({ name: 'Zen U', weight: '15' }, { name: 'Zen U', weight: '14' })).toBe(false);
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

  it('takes the spelling of the known ball and the catalog form of the weight', () => {
    expect(toGameBall('phaze 15lbs', arsenal)).toEqual({ name: 'Phaze', weight: '15' });
    expect(toGameBall({ name: 'PHAZE', weight: '15.0' }, arsenal)).toEqual({ name: 'Phaze', weight: '15' });
  });

  it('spells a ball only the known balls hold their way, weighing it from the arsenal', () => {
    const known = [...arsenal, makeBall({ ball_name: 'Zen U', core_weight: '13' })];

    expect(toGameBall('zen u', arsenal, known)).toEqual({ name: 'Zen U', weight: '15' });
  });

  it('keeps the spelling of an unknown ball', () => {
    expect(toGameBall({ name: 'hammer', weight: '15' }, arsenal)).toEqual({ name: 'hammer', weight: '15' });
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

  it('brings names to the known spelling and merges what that makes duplicates', () => {
    const game = makeGame({
      balls: [
        { name: 'phaze', weight: '15' },
        { name: 'Phaze', weight: '15' },
      ],
      frames: [makeFrame(0, [makeThrow(1, [7], { ball: { name: 'PHAZE', weight: '14' } })])],
    });

    const migrated = migrateGameBalls(game, arsenal);

    expect(migrated.balls).toEqual([{ name: 'Phaze', weight: '15' }]);
    expect(migrated.frames[0].throws[0].ball).toEqual({ name: 'Phaze', weight: '14' });
  });

  it('returns the same game when every ball is canonical', () => {
    const game = makeGame({ balls: [{ name: 'Phaze', weight: '15' }] });

    expect(migrateGameBalls(game, arsenal)).toBe(game);
  });
});

describe('arsenal balls in games', () => {
  const first = makeBall({ ball_name: 'Phaze', core_weight: '15', arsenalId: 'one' });
  const second = makeBall({ ball_name: 'Phaze', core_weight: '15', arsenalId: 'two' });
  const zen = makeBall({ ball_name: 'Zen', core_weight: '15', arsenalId: 'zen' });

  describe('keys', () => {
    it('tells two of the same ball apart, and keeps a ball that names none as it was', () => {
      expect(getThrowBallKey({ name: 'Phaze', weight: '15' })).toBe('Phaze15');
      expect(getThrowBallKey({ name: 'Phaze', weight: '15', arsenalId: 'one' })).not.toBe(
        getThrowBallKey({ name: 'Phaze', weight: '15', arsenalId: 'two' }),
      );
      expect(sameGameBall(toThrowBall(first), toThrowBall(second))).toBe(false);
      expect(getBallModelKey(toThrowBall(first))).toBe(getBallModelKey(toThrowBall(second)));
    });

    it('stores an arsenal ball with its id and a catalog ball without', () => {
      expect(toThrowBall(first)).toEqual({ name: 'Phaze', weight: '15', arsenalId: 'one' });
      expect(Object.keys(toThrowBall(makeBall({ ball_name: 'Phaze', core_weight: '15' })))).toEqual(['name', 'weight']);
    });

    it('carries the arsenal ball from the throws, without a layout', () => {
      const frames = [makeFrame(0, [makeThrow(1, [], { ball: { name: 'Phaze', weight: '15', arsenalId: 'two', drilling: { thumbSize: 1 } } })])];

      expect(getThrowBalls(frames)).toEqual([{ name: 'Phaze', weight: '15', arsenalId: 'two' }]);
    });
  });

  describe('findBall', () => {
    it('finds the arsenal ball a game ball points at', () => {
      expect(findBall({ name: 'Phaze', weight: '15', arsenalId: 'two' }, [first, second])).toBe(second);
    });

    it('falls back to name and weight for a ball that is gone, or that names none', () => {
      expect(findBall({ name: 'Phaze', weight: '15', arsenalId: 'gone' }, [first, second])).toBe(first);
      expect(findBall({ name: 'Phaze', weight: '15' }, [first, second])).toBe(first);
    });

    it('finds an arsenal ball that changed weight by its id', () => {
      const heavier = { ...first, core_weight: '16' };

      expect(findBall({ name: 'Phaze', weight: '15', arsenalId: 'one' }, [heavier])).toBe(heavier);
    });
  });

  describe('linking', () => {
    it("links a ball to the arsenal's only ball of that name and weight", () => {
      expect(toGameBall('Phaze 15lbs', [first, zen])).toEqual({ name: 'Phaze', weight: '15', arsenalId: 'one' });
      expect(toGameBall({ name: 'Zen', weight: '15' }, [first, zen])).toEqual({ name: 'Zen', weight: '15', arsenalId: 'zen' });
    });

    it('links nothing when the arsenal has the ball twice, or in another weight, or not at all', () => {
      expect(toGameBall('Phaze 15lbs', [first, second])).toEqual({ name: 'Phaze', weight: '15' });
      expect(toGameBall('Phaze 14lbs', [first])).toEqual({ name: 'Phaze', weight: '14' });
      expect(toGameBall('Hammer 15lbs', [first])).toEqual({ name: 'Hammer', weight: '15' });
    });

    it('keeps the arsenal ball and layout a ball already has', () => {
      const ball = { name: 'Phaze', weight: '15', arsenalId: 'two', drilling: { thumbSize: 1 } };

      expect(toGameBall(ball, [first])).toEqual(ball);
    });

    it('links the balls of a game and its throws, once', () => {
      const game = makeGame({
        balls: [{ name: 'Phaze', weight: '15' }],
        frames: [makeFrame(0, [makeThrow(1, [], { ball: { name: 'Phaze', weight: '15' } })])],
      });

      const linked = migrateGameBalls(game, [first]);

      expect(linked.balls).toEqual([{ name: 'Phaze', weight: '15', arsenalId: 'one' }]);
      expect(linked.frames[0].throws[0].ball).toEqual({ name: 'Phaze', weight: '15', arsenalId: 'one' });
      expect(migrateGameBalls(linked, [first])).toBe(linked);
    });

    it('leaves a game pointing at a ball that left the arsenal alone', () => {
      const game = makeGame({ balls: [{ name: 'Phaze', weight: '15', arsenalId: 'gone' }] });

      expect(migrateGameBalls(game, [first])).toBe(game);
    });
  });

  it('does not carry over the one of two of the same ball that has left the arsenal', () => {
    const frames = [
      makeFrame(0, [
        makeThrow(1, [7], { ball: { name: 'Phaze', weight: '15', arsenalId: 'one' } }),
        makeThrow(2, [], { ball: { name: 'Phaze', weight: '15', arsenalId: 'two' } }),
      ]),
    ];

    const kept = keepArsenalThrowBalls(frames, [second]);

    expect(kept[0].throws.map((t) => t.ball?.arsenalId)).toEqual([undefined, 'two']);
  });

  describe('unlinkArsenalBall', () => {
    it('takes the link off the game and its throws and keeps the layout', () => {
      const game = makeGame({
        balls: [
          { name: 'Phaze', weight: '15', arsenalId: 'one', drilling: { thumbSize: 1 } },
          { name: 'Zen', weight: '15', arsenalId: 'zen' },
        ],
        frames: [makeFrame(0, [makeThrow(1, [], { ball: { name: 'Phaze', weight: '15', arsenalId: 'one' } })])],
      });

      const unlinked = unlinkArsenalBall(game, 'one');

      expect(usesArsenalBall(game, 'one')).toBe(true);
      expect(unlinked.balls).toEqual([
        { name: 'Phaze', weight: '15', drilling: { thumbSize: 1 } },
        { name: 'Zen', weight: '15', arsenalId: 'zen' },
      ]);
      expect(unlinked.frames[0].throws[0].ball).toEqual({ name: 'Phaze', weight: '15' });
    });

    it('returns the same game when it never used the ball', () => {
      const game = makeGame({ balls: [{ name: 'Zen', weight: '15', arsenalId: 'zen' }] });

      expect(unlinkArsenalBall(game, 'one')).toBe(game);
    });
  });

  describe('withBallLayouts', () => {
    const drilling = { layout: { system: 'dual-angle' as const, drillingAngle: 45, pinToPap: 4.5, valAngle: 30 } };
    const drilled = { ...first, drilling };

    it('records the layout of a ball new to the game', () => {
      const game = makeGame({ balls: [toThrowBall(first)] });

      expect(withBallLayouts(game, undefined, [drilled]).balls).toEqual([{ ...toThrowBall(first), drilling }]);
    });

    it('records nothing for a ball without drilling, an empty drilling, or a ball outside the arsenal', () => {
      const game = makeGame({ balls: [toThrowBall(first), { name: 'Hammer', weight: '15' }] });

      expect(withBallLayouts(game, undefined, [{ ...first, drilling: {} }])).toBe(game);
      expect(withBallLayouts(game, undefined, [first])).toBe(game);
    });

    it('keeps what the game was saved with: the layout then, or none', () => {
      const then = { thumbSize: 1 };
      const game = makeGame({ balls: [toThrowBall(first), toThrowBall(zen)] });
      const saved = makeGame({ balls: [{ ...toThrowBall(first), drilling: then }, toThrowBall(zen)] });

      const balls = withBallLayouts(game, saved, [drilled, { ...zen, drilling }]).balls;

      expect(balls).toEqual([{ ...toThrowBall(first), drilling: then }, toThrowBall(zen)]);
    });

    it('records the other one of two of the same ball as a new ball', () => {
      const game = makeGame({ balls: [toThrowBall(second)] });
      const saved = makeGame({ balls: [{ ...toThrowBall(first), drilling: { thumbSize: 1 } }] });

      expect(withBallLayouts(game, saved, [first, { ...second, drilling }]).balls).toEqual([{ ...toThrowBall(second), drilling }]);
    });

    it('rebuilds the balls from the throws in per-throw tracking', () => {
      const game = makeGame({
        ballTracking: 'throw',
        balls: [toThrowBall(zen)],
        frames: [makeFrame(0, [makeThrow(1, [], { ball: toThrowBall(first) })])],
      });

      expect(withBallLayouts(game, undefined, [drilled]).balls).toEqual([{ ...toThrowBall(first), drilling }]);
    });

    it('leaves a game without a ball selection alone', () => {
      const game = makeGame();

      expect(withBallLayouts(game, undefined, [drilled])).toBe(game);
    });
  });

  describe('fromBallFilterValue', () => {
    it('reads the arsenal ball a filter value names', () => {
      const arsenalId = '0b9f6a52-7c1e-4d0a-9a43-1f2e3d4c5b6a';
      const twin = { ...second, arsenalId };
      const value = getThrowBallKey(toThrowBall(twin));

      expect(fromBallFilterValue(value, [first, twin])).toEqual({ name: 'Phaze', weight: '15', arsenalId });
    });

    it('does not take a number sign in a ball name for an arsenal ball', () => {
      expect(fromBallFilterValue('Hammer #1 15lbs', [first])).toEqual({ name: 'Hammer #1', weight: '15' });
    });

    it('brings an older value to the ball games hold today', () => {
      expect(fromBallFilterValue('Phaze 15lbs', [first])).toEqual({ name: 'Phaze', weight: '15', arsenalId: 'one' });
      expect(fromBallFilterValue('Phaze15', [first, second])).toEqual({ name: 'Phaze', weight: '15' });
    });
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
