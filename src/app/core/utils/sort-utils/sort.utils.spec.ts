import { HighlightItemStats } from 'src/app/core/models/stats.model';
import { sortGenericItems } from './sort.utils';

describe('sortGenericItems', () => {
  const item = (name: string, avg: number, gameCount: number): HighlightItemStats => ({
    name,
    image: '',
    avg,
    highestGame: 0,
    lowestGame: 0,
    gameCount,
  });

  // High avg / low plays vs low avg / high plays so the two modes disagree.
  const lowPlaysHighAvg = item('best', 300, 1);
  const highPlaysLowAvg = item('most-played', 270, 4);

  it("sorts by avg descending in 'score' mode", () => {
    const result = sortGenericItems([highPlaysLowAvg, lowPlaysHighAvg], 'score');
    expect(result.map((i) => i.name)).toEqual(['best', 'most-played']);
  });

  it("sorts by gameCount descending in 'plays' mode", () => {
    const result = sortGenericItems([lowPlaysHighAvg, highPlaysLowAvg], 'plays');
    expect(result.map((i) => i.name)).toEqual(['most-played', 'best']);
  });

  it('does not mutate the input array', () => {
    const input = [highPlaysLowAvg, lowPlaysHighAvg];
    sortGenericItems(input, 'score');
    expect(input).toEqual([highPlaysLowAvg, lowPlaysHighAvg]);
  });
});
