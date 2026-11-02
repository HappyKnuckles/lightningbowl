import { dailyMinigameLane, minigameFrameComplete, minigameRackSize, minigameScores, minigameThrowLabels } from './minigame.utils';

describe('minigame scoring', () => {
  it('scores a perfect game as 300', () => {
    const frames = [...Array.from({ length: 9 }, () => [10]), [10, 10, 10]];
    expect(minigameScores(frames)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
  });

  it('scores all spares and open frames', () => {
    expect(minigameScores([...Array.from({ length: 9 }, () => [5, 5]), [5, 5, 5]])[9]).toBe(150);
    expect(minigameScores(Array.from({ length: 10 }, () => [9, 0]))[9]).toBe(90);
    expect(minigameScores(Array.from({ length: 10 }, () => [0, 0]))[9]).toBe(0);
  });

  it('waits for strike and spare bonuses', () => {
    expect(minigameScores([[10], [4]])[0]).toBeNull();
    expect(minigameScores([[10], [4, 3]])[0]).toBe(17);
    expect(minigameScores([[7, 3], []])[0]).toBeNull();
    expect(minigameScores([[7, 3], [4]])[0]).toBe(14);
  });

  it('only earns bonus balls after a tenth-frame strike or spare', () => {
    expect(minigameFrameComplete([9, 0], 9)).toBe(true);
    expect(minigameFrameComplete([10, 4], 9)).toBe(false);
    expect(minigameFrameComplete([4, 6], 9)).toBe(false);
    expect(minigameFrameComplete([10, 4, 6], 9)).toBe(true);
  });

  it('re-racks correctly for tenth-frame bonus balls', () => {
    expect(minigameRackSize([10], 9)).toBe(10);
    expect(minigameRackSize([4, 6], 9)).toBe(10);
    expect(minigameRackSize([10, 10], 9)).toBe(10);
    expect(minigameRackSize([10, 4], 9)).toBe(6);
    expect(minigameRackSize([10, 0], 9)).toBe(10);
    expect(minigameRackSize([7], 0)).toBe(3);
  });

  it('distinguishes strikes from spares on fresh bonus racks', () => {
    expect(minigameThrowLabels([10, 10, 10], 9)).toEqual(['X', 'X', 'X']);
    expect(minigameThrowLabels([10, 0, 10], 9)).toEqual(['X', '–', '/']);
    expect(minigameThrowLabels([0, 10, 10], 9)).toEqual(['–', '/', 'X']);
    expect(minigameThrowLabels([10, 4, 6], 9)).toEqual(['X', '4', '/']);
  });

  it('selects a repeatable lane for each UTC date', () => {
    expect(dailyMinigameLane('2026-11-02')).toEqual(dailyMinigameLane('2026-11-02'));
    expect(dailyMinigameLane('2026-11-03')).not.toEqual(dailyMinigameLane('2026-11-02'));
  });
});
