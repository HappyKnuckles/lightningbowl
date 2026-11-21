/** Longest selectable part of a video (the tracker stops after 20 s). */
export const MAX_SHOT_WINDOW_S = 18;

export interface TrimWindow {
  endS: number;
  startS: number;
}

/** Default selection for a freshly loaded video: from the start, as long as the tracker allows. */
export function defaultTrimWindow(durationS: number): TrimWindow {
  return { startS: 0, endS: Math.min(durationS, MAX_SHOT_WINDOW_S) };
}

/**
 * Applies a knob move of the dual range: values are clamped to the video and the selection to
 * {@link MAX_SHOT_WINDOW_S}, moving the knob that was not dragged along when the window gets too long.
 */
export function clampTrimWindow(next: TrimWindow, previous: TrimWindow, durationS: number): TrimWindow {
  let startS = Math.max(0, Math.min(next.startS, durationS));
  let endS = Math.max(startS, Math.min(next.endS, durationS));
  if (endS - startS > MAX_SHOT_WINDOW_S) {
    if (startS !== previous.startS) {
      endS = startS + MAX_SHOT_WINDOW_S;
    } else {
      startS = endS - MAX_SHOT_WINDOW_S;
    }
  }
  return { startS, endS };
}
