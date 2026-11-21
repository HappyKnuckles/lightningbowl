import { BallDrilling } from 'src/app/core/models/ball.model';
import { makeBall, makeGame } from 'src/testing/fixtures';
import {
  arsenalBallLabel,
  gameBallLabel,
  isInArsenal,
  isRetired,
  newArsenalId,
  ownBallFields,
  savedGameBallLabeler,
  twinLabel,
} from './arsenal-ball.utils';

const layout = (drillingAngle: number): BallDrilling => ({ layout: { system: 'dual-angle', drillingAngle, pinToPap: 4, valAngle: 30 } });

describe('arsenal-ball.utils', () => {
  const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15', arsenalId: 'zen' });
  const first = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15', arsenalId: 'one', drilling: layout(45) });
  const second = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15', arsenalId: 'two', drilling: layout(70) });

  it('makes ids that differ', () => {
    expect(newArsenalId()).not.toBe(newArsenalId());
  });

  it("names what is the bowler's own on an arsenal ball", () => {
    const ball = makeBall({ arsenalId: 'one', position: 2, drilling: layout(45), nickname: 'benchmark', note: 'sanded to 2000', retiredAt: 5 });

    expect(ownBallFields(ball)).toEqual({
      arsenalId: 'one',
      position: 2,
      drilling: layout(45),
      nickname: 'benchmark',
      note: 'sanded to 2000',
      retiredAt: 5,
    });
  });

  it('knows a retired ball by its retirement date', () => {
    expect(isRetired(makeBall({ retiredAt: 1_700_000_000_000 }))).toBe(true);
    expect(isRetired(makeBall())).toBe(false);
  });

  it('knows whether the arsenal has a ball in a weight', () => {
    expect(isInArsenal(makeBall({ ball_id: 'p', core_weight: '15' }), [first])).toBe(true);
    expect(isInArsenal(makeBall({ ball_id: 'p', core_weight: '14' }), [first])).toBe(false);
  });

  describe('labels', () => {
    it('shows a nickname before anything else, also for a ball owned once', () => {
      const named = { ...zen, nickname: 'benchmark' };
      const namedTwin = { ...first, nickname: 'pin up' };

      expect(arsenalBallLabel(named, [named, first])).toBe('Zen 15lbs · benchmark');
      expect(twinLabel(namedTwin, [namedTwin, second])).toBe('pin up');
      expect(gameBallLabel({ name: 'Zen', weight: '15', arsenalId: 'zen' }, [named])).toBe('Zen 15lbs · benchmark');
    });

    it('shows a ball owned once by name and weight', () => {
      expect(twinLabel(zen, [zen, first])).toBe('');
      expect(arsenalBallLabel(zen, [zen, first])).toBe('Zen 15lbs');
    });

    it('tells two of the same ball apart by their layout', () => {
      expect(arsenalBallLabel(first, [first, second])).toBe('Phaze II 15lbs · 45° × 4" × 30°');
      expect(arsenalBallLabel(second, [first, second])).toBe('Phaze II 15lbs · 70° × 4" × 30°');
    });

    it('numbers them when the layout does not tell them apart', () => {
      const same = { ...second, drilling: layout(45) };
      const blank = { ...second, arsenalId: 'three', drilling: undefined };

      expect(twinLabel(first, [first, same])).toBe('#1');
      expect(twinLabel(same, [first, same])).toBe('#2');
      expect(twinLabel(blank, [first, blank])).toBe('#2');
      expect(twinLabel(first, [first, blank])).toBe('45° × 4" × 30°');
    });

    it("labels a game's ball like its arsenal ball, with the name and weight the game recorded", () => {
      expect(gameBallLabel({ name: 'Phaze II', weight: '15', arsenalId: 'two' }, [first, second])).toBe('Phaze II 15lbs · 70° × 4" × 30°');
      expect(gameBallLabel({ name: 'Zen', weight: '14', arsenalId: 'zen' }, [zen])).toBe('Zen 14lbs');
      expect(gameBallLabel({ name: 'Phaze II', weight: '15' }, [first, second])).toBe('Phaze II 15lbs');
      expect(gameBallLabel({ name: 'Phaze II', weight: '15', arsenalId: 'gone' }, [first])).toBe('Phaze II 15lbs');
      expect(gameBallLabel(undefined, [first])).toBe('');
    });

    it('labels the balls of a saved game with the layout the game recorded, not the one of today', () => {
      const game = makeGame({
        balls: [
          { name: 'Phaze II', weight: '15', arsenalId: 'one', drilling: layout(20) },
          { name: 'Zen', weight: '15', arsenalId: 'zen' },
        ],
      });
      const label = savedGameBallLabeler(game, [first, second, zen]);

      // also for a throw's ball, which carries no layout of its own
      expect(label({ name: 'Phaze II', weight: '15', arsenalId: 'one' })).toBe('Phaze II 15lbs · 20° × 4" × 30°');
      expect(label({ name: 'Zen', weight: '15', arsenalId: 'zen' })).toBe('Zen 15lbs');
      expect(label(undefined)).toBe('');
    });
  });
});
