export interface MinigameLane {
  name: string;
  oilLength: number;
  friction: number;
}

const LANES: MinigameLane[] = [
  { name: 'House shot', oilLength: 40, friction: 1 },
  { name: 'Short & snappy', oilLength: 34, friction: 1.25 },
  { name: 'Long glide', oilLength: 46, friction: 0.75 },
  { name: 'Dry back end', oilLength: 38, friction: 1.4 },
];

/** UTC dates keep the daily lane the same everywhere. */
export function dailyMinigameLane(date: string): MinigameLane {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return LANES[((day % LANES.length) + LANES.length) % LANES.length];
}

export function minigameFrameComplete(frame: number[], index: number): boolean {
  if (index < 9) return frame[0] === 10 || frame.length === 2;
  return frame.length === 3 || (frame.length === 2 && frame[0] + frame[1] < 10);
}

/** Number of standing pins on the next delivery, including tenth-frame re-racks. */
export function minigameRackSize(frame: number[], index: number): number {
  if (!frame.length || minigameFrameComplete(frame, index)) return 10;
  if (index === 9 && (frame.at(-1) === 10 || (frame.length === 2 && frame[0] + frame[1] === 10))) return 10;
  return 10 - (index === 9 && frame[0] === 10 ? frame[1] : frame.reduce((sum, pins) => sum + pins, 0));
}

/** Unresolved strike/spare bonuses stay blank rather than displaying a misleading total. */
export function minigameScores(frames: number[][]): (number | null)[] {
  let total = 0;
  let pending = false;
  return Array.from({ length: 10 }, (_, index) => {
    const frame = frames[index] ?? [];
    if (pending || !minigameFrameComplete(frame, index)) {
      pending = true;
      return null;
    }
    if (index === 9) {
      total += frame.reduce((sum, pins) => sum + pins, 0);
      return total;
    }
    const bonusCount = frame[0] === 10 ? 2 : frame[0] + frame[1] === 10 ? 1 : 0;
    const bonus = frames
      .slice(index + 1)
      .flat()
      .slice(0, bonusCount);
    if (bonus.length < bonusCount) {
      pending = true;
      return null;
    }
    total += frame.reduce((sum, pins) => sum + pins, 0) + bonus.reduce((sum, pins) => sum + pins, 0);
    return total;
  });
}

export function minigameThrowLabels(frame: number[], index: number): string[] {
  return frame.map((pins, ball) => {
    if (pins === 10 && (ball === 0 || (index === 9 && (ball === 1 ? frame[0] === 10 : frame[0] !== 10 || frame[1] === 10)))) return 'X';
    if (ball > 0 && frame[ball - 1] !== 10 && frame[ball - 1] + pins === 10) return '/';
    return pins === 0 ? '–' : String(pins);
  });
}
