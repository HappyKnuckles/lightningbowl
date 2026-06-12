export const BOWWWL_URL = 'https://bowwwl.com';
export const PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const PIN_TO_COLUMN: Record<number, number> = {
  7: 1,
  4: 2,
  2: 3,
  8: 3,
  1: 4,
  5: 4,
  3: 5,
  9: 5,
  6: 6,
  10: 7,
};

export const UNMAKEABLE_SPLITS: number[][] = [
  [7, 10],
  [4, 6],
  [4, 6, 7],
  [4, 6, 10],
  [4, 7, 10],
  [6, 7, 10],
  [4, 6, 7, 10],
  [4, 6, 7, 9],
  [4, 6, 7, 9, 10],
];
