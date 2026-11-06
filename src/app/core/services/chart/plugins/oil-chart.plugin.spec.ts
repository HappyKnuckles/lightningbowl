import { withAlpha } from './oil-chart.plugin';

describe('withAlpha', () => {
  it('adds opacity to named and hex colors', () => {
    expect(withAlpha('red', 0.4)).toBe('rgba(255, 0, 0, 0.4)');
    expect(withAlpha('#ed8e07', 0.85)).toBe('rgba(237, 142, 7, 0.85)');
  });
});
