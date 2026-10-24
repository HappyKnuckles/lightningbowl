import { timestampedFileName } from './file-name.utils';

describe('timestampedFileName', () => {
  it('appends a sortable local date and time', () => {
    expect(timestampedFileName('game_data', 'xlsx', new Date(2026, 9, 25, 1, 7))).toBe('game_data_2026-10-25_01-07.xlsx');
  });

  it('gives exports on the same day different names', () => {
    const morning = timestampedFileName('game_data', 'xlsx', new Date(2026, 0, 3, 9, 15));
    const evening = timestampedFileName('game_data', 'xlsx', new Date(2026, 0, 3, 21, 40));
    expect(morning).not.toBe(evening);
  });
});
