/**
 * Associates detections into tracks and picks the ball's (port of the BallTracker's `tracker.py`).
 * Runs in lane inches, where the ball moves almost linearly from frame to frame.
 */
import { polyfit } from './math.utils';

export const MIN_SPEED_IN_S = 100; // ~5.7 mph
export const MAX_SPEED_IN_S = 650; // ~37 mph
// the ball can vanish behind the bowler for most of a second
const MAX_OCCLUSION_S = 1.2;

export interface Detection {
  frame: number;
  /** Contact point in (lane crop) image pixels. */
  px: [number, number];
  /** Lane inches one pixel covers down-lane; grows towards the pins. */
  sigmaYIn: number;
  /** Observed width / expected ball width at that distance. */
  sizeRatio: number;
  t: number;
  xIn: number;
  yIn: number;
}

export class Track {
  missed = 0;

  constructor(readonly points: Detection[]) {}

  get last(): Detection {
    return this.points[this.points.length - 1];
  }

  get progressIn(): number {
    return this.last.yIn - this.points[0].yIn;
  }

  /** Inches per second (x, y) from the last few points. */
  velocity(): [number, number] | null {
    if (this.points.length < 2) return null;
    const recent = this.points.slice(-8);
    const t = recent.map((p) => p.t);
    if (t[t.length - 1] - t[0] <= 0) return null;
    const w = recent.map((p) => 1 / p.sigmaYIn);
    return [
      polyfit(
        t,
        recent.map((p) => p.xIn),
        1,
      )[0],
      polyfit(
        t,
        recent.map((p) => p.yIn),
        1,
        w,
      )[0],
    ];
  }

  /** Predicted position plus lateral and base down-lane gates (inches) at time `t`. */
  predict(t: number): { gateX: number; gateY: number; pos: [number, number] } {
    const dt = t - this.last.t;
    const v = this.velocity();
    if (!v) {
      return { pos: [this.last.xIn, this.last.yIn + 375 * dt], gateX: 14 + 120 * dt, gateY: 14 + 300 * dt };
    }
    const recent = this.points.slice(-8);
    const tMean = recent.reduce((sum, p) => sum + p.t, 0) / recent.length;
    let wSum = 0;
    let ySum = 0;
    for (const p of recent) {
      wSum += 1 / p.sigmaYIn;
      ySum += p.yIn / p.sigmaYIn;
    }
    const yPred = ySum / wSum + v[1] * (t - tMean);
    return { pos: [this.last.xIn + v[0] * dt, yPred], gateX: 5 + 60 * dt, gateY: 6 + 60 * dt };
  }

  isPlausible(minPoints: number): boolean {
    if (this.points.length < minPoints || this.progressIn <= 0) return false;
    const duration = this.last.t - this.points[0].t;
    if (duration <= 0) return false;
    const speed = this.progressIn / duration;
    return speed >= MIN_SPEED_IN_S && speed <= MAX_SPEED_IN_S;
  }
}

export class BallTracker {
  active: Track[] = [];
  finished: Track[] = [];

  constructor(
    private maxGapS = 0.25,
    private minPoints = 6,
  ) {}

  update(t: number, detections: Detection[]): void {
    const unmatched = [...detections];
    // longer tracks pick first, so a stray blob can't steal the ball's detection
    for (const track of [...this.active].sort((a, b) => b.points.length - a.points.length)) {
      if (unmatched.length === 0) break;
      const { pos, gateX, gateY } = track.predict(t);
      let best: Detection | null = null;
      let bestD = 1;
      for (const det of unmatched) {
        const dy = det.yIn - track.last.yIn;
        if (Math.abs(det.xIn - track.last.xIn) > 4 + 0.35 * Math.max(0, dy)) continue;
        const gy = gateY + 10 * det.sigmaYIn;
        let d = Math.hypot((det.xIn - pos[0]) / gateX, (det.yIn - pos[1]) / gy);
        d += 0.3 * Math.abs(1 - det.sizeRatio);
        if (d < bestD) {
          best = det;
          bestD = d;
        }
      }
      if (best) {
        track.points.push(best);
        track.missed = 0;
        unmatched.splice(unmatched.indexOf(best), 1);
      } else {
        track.missed++;
      }
    }
    const stillActive: Track[] = [];
    for (const track of this.active) {
      if (t - track.last.t > this.maxGapS) this.finished.push(track);
      else stillActive.push(track);
    }
    this.active = stillActive;
    for (const det of unmatched) this.active.push(new Track([det]));
  }

  bestTrack(): Track | null {
    const tracks = [...this.finished, ...this.active].filter((tr) => tr.points.length >= 3);
    const chains = tracks.map((tr) =>
      this.stitch(
        tr,
        tracks.filter((o) => o !== tr),
      ),
    );
    const candidates = chains.filter((tr) => tr.isPlausible(this.minPoints));
    if (candidates.length === 0) return null;
    const furthest = Math.max(...candidates.map((tr) => tr.progressIn));
    const longEnough = candidates.filter((tr) => tr.progressIn >= 0.7 * furthest);
    // most points first, then furthest (Python's max over the tuple keeps the first maximum)
    let best = longEnough[0];
    for (const tr of longEnough) {
      if (tr.points.length > best.points.length || (tr.points.length === best.points.length && tr.progressIn > best.progressIn)) best = tr;
    }
    return best;
  }

  /** Extends a track with fragments that continue it (split blobs, an occlusion behind the bowler). */
  private stitch(start: Track, others: Track[]): Track {
    const track = new Track([...start.points]);
    const used = new Set<Track>();
    for (;;) {
      const last = track.last;
      const velocity = track.velocity();
      const speed = velocity && velocity[1] > 0 ? velocity[1] : 375;
      let follow: { other: Track; score: number } | null = null;
      for (const other of others) {
        if (used.has(other) || other.points.length < 3) continue;
        const later = other.points.filter((p) => p.t > last.t);
        if (later.length < 3) continue;
        const first = later[0];
        const gap = first.t - last.t;
        if (gap > MAX_OCCLUSION_S) continue;
        const dy = first.yIn - (last.yIn + speed * gap);
        const dx = first.xIn - last.xIn;
        if (Math.abs(dy) > 24 + 10 * first.sigmaYIn || Math.abs(dx) > 6 + 0.35 * Math.max(0, first.yIn - last.yIn)) continue;
        const score = Math.abs(dy) / (24 + 10 * first.sigmaYIn) + gap;
        if (!follow || score < follow.score) follow = { score, other };
      }
      if (!follow) return track;
      used.add(follow.other);
      track.points.push(...follow.other.points.filter((p) => p.t > last.t));
    }
  }
}
