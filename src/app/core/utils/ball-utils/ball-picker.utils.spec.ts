import { makeBall } from 'src/testing/fixtures';
import { ballPickerFor, pickedGameBalls } from './ball-picker.utils';

describe('ball-picker.utils', () => {
  const catalogPhaze = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15' });
  const first = { ...catalogPhaze, arsenalId: 'one' };
  const second = { ...catalogPhaze, arsenalId: 'two' };
  const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15', arsenalId: 'zen' });
  const hammer = makeBall({ ball_id: 'h', ball_name: 'Hammer', core_weight: '15' });

  describe('ballPickerFor', () => {
    it('lists the arsenal and selects the balls of the game', () => {
      const picker = ballPickerFor([{ name: 'Zen', weight: '15', arsenalId: 'zen' }], [first, zen], [first, zen, hammer]);

      expect(picker.items).toEqual([first, zen]);
      expect(picker.selected).toEqual([zen.key]);
    });

    it('lists a ball of the game that has left the arsenal, so it stays selected', () => {
      const picker = ballPickerFor([{ name: 'Hammer', weight: '15' }], [zen], [zen, hammer]);

      expect(picker.items).toEqual([zen, hammer]);
      expect(picker.selected).toEqual([hammer.key]);
    });

    it('lists a ball owned twice once', () => {
      const picker = ballPickerFor([{ name: 'Phaze II', weight: '15', arsenalId: 'two' }], [first, second, zen], [first, zen]);

      expect(picker.items).toEqual([first, zen]);
      expect(picker.selected).toEqual([first.key]);
    });
  });

  describe('pickedGameBalls', () => {
    it('keeps a ball the game already had exactly as it was', () => {
      const current = [{ name: 'Phaze II', weight: '15', arsenalId: 'two', drilling: { thumbSize: 1 } }];

      expect(pickedGameBalls([first, zen], current, [first, second, zen])).toEqual([current[0], { name: 'Zen', weight: '15', arsenalId: 'zen' }]);
    });

    it("makes a ball picked from the catalog the arsenal's ball of that model", () => {
      expect(pickedGameBalls([catalogPhaze], undefined, [first])).toEqual([{ name: 'Phaze II', weight: '15', arsenalId: 'one' }]);
    });

    it('stores a ball that is not in the arsenal by name and weight', () => {
      expect(pickedGameBalls([hammer], [], [zen])).toEqual([{ name: 'Hammer', weight: '15' }]);
    });
  });
});
