import { HandicapConfig } from 'src/app/core/models/league';
import { HandicapService } from './handicap.service';

describe('HandicapService', () => {
  let service: HandicapService;

  beforeEach(() => {
    service = new HandicapService();
  });

  const percent = (percentage: number, baseScore: number): HandicapConfig => ({ system: 'percentOfBase', percentage, baseScore });

  it('computes 90% of 220 at average 180 as 36', () => {
    expect(service.handicapForAverage(percent(90, 220), 180)).toBe(36);
  });

  it('floors the handicap and never returns a negative value', () => {
    expect(service.handicapForAverage(percent(80, 200), 205)).toBe(0); // average above base
    expect(service.handicapForAverage(percent(100, 210), 197.6)).toBe(12); // floor(12.4)
  });

  it('returns 0 for scratch and custom systems', () => {
    expect(service.handicapForAverage({ system: 'scratch', percentage: 90, baseScore: 220 }, 150)).toBe(0);
    expect(service.handicapForAverage({ system: 'custom', percentage: 90, baseScore: 220 }, 150)).toBe(0);
  });

  it('adds handicap to a scratch score', () => {
    expect(service.handicapScore(percent(90, 220), 170, 180)).toBe(170 + 36);
  });
});
