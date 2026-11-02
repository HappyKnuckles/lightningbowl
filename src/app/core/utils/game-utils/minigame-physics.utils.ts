import { MinigameLane } from './minigame.utils';

export interface MinigameBody {
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
}

export interface MinigamePin extends MinigameBody {
  fallen: boolean;
  fallingAngle: number;
  height: number;
  width: number;
}

export interface MinigameBall extends MinigameBody {
  curve: number;
  inGutter: boolean;
  radius: number;
}

const BALL_MASS = 16;
const PIN_MASS = 3.5;
const SUBSTEPS = 4;
const STEP = 1 / SUBSTEPS;

/** Aim changes direction, not total release energy. Positive hook turns right. */
export function minigameDelivery(power: number, aim: number, hook: number) {
  const speed = 7 + Math.max(0, Math.min(1, power)) * 5;
  const heading = Math.atan(aim);
  return { velocityX: Math.sin(heading) * speed, velocityY: -Math.cos(heading) * speed, curve: hook * 0.006 };
}

/** Resolve only approaching contacts. Impulses conserve momentum and cannot add energy. */
function collide(a: MinigameBody, b: MinigameBody, radius: number, massA: number, massB: number, restitution: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return 0;
  const nx = distance > 0.0001 ? dx / distance : 0;
  const ny = distance > 0.0001 ? dy / distance : -1;
  const inverseMass = 1 / massA + 1 / massB;
  const correction = (Math.max(0, radius - distance - 0.01) * 0.8) / inverseMass;
  a.x -= (nx * correction) / massA;
  a.y -= (ny * correction) / massA;
  b.x += (nx * correction) / massB;
  b.y += (ny * correction) / massB;

  const closingSpeed = (a.velocityX - b.velocityX) * nx + (a.velocityY - b.velocityY) * ny;
  if (closingSpeed <= 0) return 0;
  const impulse = ((1 + restitution) * closingSpeed) / inverseMass;
  a.velocityX -= (impulse * nx) / massA;
  a.velocityY -= (impulse * ny) / massA;
  b.velocityX += (impulse * nx) / massB;
  b.velocityY += (impulse * ny) / massB;
  return impulse;
}

/** One deterministic 60 Hz tick, subdivided to avoid tunnelling through pins. */
export function stepMinigamePhysics(ball: MinigameBall | null, pins: MinigamePin[], lane: MinigameLane): MinigamePin[] {
  const knocked: MinigamePin[] = [];
  const topple = (pin: MinigamePin, impulse: number) => {
    if (pin.fallen || impulse < 2.2) return;
    pin.fallen = true;
    // A pin falls along its impact direction, not always to the right.
    pin.fallingAngle = Math.atan2(pin.velocityY, pin.velocityX) + Math.PI / 2;
    knocked.push(pin);
  };

  for (let step = 0; step < SUBSTEPS; step++) {
    if (ball) {
      if (!ball.inGutter) {
        const oilEnd = 550 - (lane.oilLength / 60) * 420;
        const transition = Math.max(0, Math.min(1, (oilEnd + 24 - ball.y) / 64));
        const dry = transition * transition * (3 - 2 * transition);
        // Dry outside boards offer a little recovery, but never unlimited lateral acceleration.
        const outside = Math.min(1, Math.abs(ball.x - 140) / 105);
        const traction = (0.025 + dry * 0.975) * lane.friction * (1 + outside * 0.12);
        const speed = Math.hypot(ball.velocityX, ball.velocityY);
        const heading = Math.atan2(ball.velocityX, -ball.velocityY);
        const turn = ball.curve * traction * STEP * (9 / Math.max(6, speed));
        const nextSpeed = speed * Math.pow(1 - 0.0007 - dry * 0.0012, STEP);
        ball.velocityX = Math.sin(heading + turn) * nextSpeed;
        ball.velocityY = -Math.cos(heading + turn) * nextSpeed;
      }
      ball.x += ball.velocityX * STEP;
      ball.y += ball.velocityY * STEP;
      // The centre must cross the lane edge. Once dropped, a ball cannot re-enter.
      if (ball.inGutter || ball.x < 18 || ball.x > 262) {
        ball.inGutter = true;
        ball.x = ball.x < 140 ? 9 : 271;
        ball.velocityX = 0;
        ball.curve = 0;
      }
    }

    for (const pin of pins) {
      pin.x += pin.velocityX * STEP;
      pin.y += pin.velocityY * STEP;
      const damping = Math.pow(pin.fallen ? 0.965 : 0.8, STEP);
      pin.velocityX *= damping;
      pin.velocityY *= damping;
      if (Math.hypot(pin.velocityX, pin.velocityY) < 0.035) pin.velocityX = pin.velocityY = 0;
      // Pins leave through the pit; side kickbacks dissipate energy instead of trapping them.
      if (pin.y > -30 && pin.x < 12) {
        pin.x = 12;
        pin.velocityX = Math.abs(pin.velocityX) * 0.35;
      } else if (pin.y > -30 && pin.x > 268) {
        pin.x = 268;
        pin.velocityX = -Math.abs(pin.velocityX) * 0.35;
      }
    }

    if (ball && !ball.inGutter) {
      for (const pin of pins) {
        if (pin.y < -30) continue;
        const impulse = collide(ball, pin, ball.radius + pin.width / 2, BALL_MASS, PIN_MASS, 0.55);
        topple(pin, impulse);
      }
    }

    // Each unordered pair is handled exactly once per substep, including during settling.
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i];
        const b = pins[j];
        if (a.y < -30 || b.y < -30 || (!a.fallen && !b.fallen)) continue;
        const radiusA = a.fallen ? a.height * 0.3 : a.width / 2;
        const radiusB = b.fallen ? b.height * 0.3 : b.width / 2;
        const impulse = collide(a, b, radiusA + radiusB, PIN_MASS, PIN_MASS, 0.45);
        topple(a, impulse);
        topple(b, impulse);
      }
    }
  }
  return knocked;
}