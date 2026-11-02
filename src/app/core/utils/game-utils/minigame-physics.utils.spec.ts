import type { MinigameBall, MinigamePin } from './minigame-physics.utils';

import { minigameDelivery, stepMinigamePhysics } from './minigame-physics.utils';

const lane = { name: 'House shot', oilLength: 40, friction: 1 };

function makeBall(overrides: Partial<MinigameBall> = {}): MinigameBall {
  return { x: 140, y: 550, radius: 23, inGutter: false, ...minigameDelivery(0.65, 0, 0), ...overrides };
}

function makePin(x: number, y: number, overrides: Partial<MinigamePin> = {}): MinigamePin {
  return { x, y, width: 24, height: 50, velocityX: 0, velocityY: 0, fallen: false, fallingAngle: 0, ...overrides };
}

function makeRack(): MinigamePin[] {
  return [
    [62, 32],
    [114, 32],
    [166, 32],
    [218, 32],
    [88, 64],
    [140, 64],
    [192, 64],
    [114, 96],
    [166, 96],
    [140, 128],
  ].map(([x, y]) => makePin(x, y));
}

function roll(ball: MinigameBall, pins: MinigamePin[]) {
  const knocked: MinigamePin[] = [];
  for (let tick = 0; tick < 200; tick++) knocked.push(...stepMinigamePhysics(ball.y > -60 ? ball : null, pins, lane));
  return knocked;
}

describe('minigame physics', () => {
  it('keeps release speed independent of aim and clamps power', () => {
    for (const aim of [-0.45, 0, 0.45]) {
      const delivery = minigameDelivery(0.6, aim, 0);
      expect(Math.hypot(delivery.velocityX, delivery.velocityY)).toBeCloseTo(10);
    }
    expect(minigameDelivery(-1, 0, 0).velocityY).toBe(-7);
    expect(minigameDelivery(2, 0, 0).velocityY).toBe(-12);
  });

  it('keeps a straight release straight without adding energy', () => {
    const ball = makeBall();
    const initialSpeed = Math.hypot(ball.velocityX, ball.velocityY);
    for (let tick = 0; tick < 45; tick++) stepMinigamePhysics(ball, [], lane);
    expect(ball.x).toBe(140);
    expect(Math.hypot(ball.velocityX, ball.velocityY)).toBeLessThan(initialSpeed);
  });

  it('skids on oil before breaking, with mirrored left and right hooks', () => {
    const left = makeBall(minigameDelivery(0.65, 0, -3));
    const right = makeBall(minigameDelivery(0.65, 0, 3));
    for (let tick = 0; tick < 20; tick++) {
      stepMinigamePhysics(left, [], lane);
      stepMinigamePhysics(right, [], lane);
    }
    const earlyDeflection = right.x - 140;
    expect(earlyDeflection).toBeLessThan(2);
    for (let tick = 0; tick < 25; tick++) {
      stepMinigamePhysics(left, [], lane);
      stepMinigamePhysics(right, [], lane);
    }
    expect(right.x - 140).toBeGreaterThan(earlyDeflection * 5);
    expect(left.x + right.x).toBeCloseTo(280);
  });

  it('hooks earlier on short oil than on long oil', () => {
    const short = makeBall(minigameDelivery(0.65, 0, 3));
    const long = structuredClone(short);
    for (let tick = 0; tick < 42; tick++) {
      stepMinigamePhysics(short, [], { ...lane, oilLength: 34 });
      stepMinigamePhysics(long, [], { ...lane, oilLength: 46 });
    }
    expect(short.x).toBeGreaterThan(long.x + 5);
  });

  it('does not let a gutter ball return or hit pins', () => {
    const ball = makeBall({ x: 19, y: 160, velocityX: -6, curve: -0.03 });
    const pin = makePin(30, 128);
    const knocked = roll(ball, [pin]);
    expect(ball.inGutter).toBe(true);
    expect(ball.x).toBe(9);
    expect(ball.velocityX).toBe(0);
    expect(knocked).toHaveLength(0);
  });

  it('transfers impact momentum forward and counts a pin only once', () => {
    const ball = makeBall({ y: 166 });
    const pin = makePin(140, 128);
    const knocked = roll(ball, [pin]);
    expect(knocked).toHaveLength(1);
    expect(pin.fallen).toBe(true);
    expect(pin.y).toBeLessThan(128);
    expect(pin.velocityY).toBeLessThanOrEqual(0);
  });

  it('does not add gravity or movement to a resting fallen pin', () => {
    const pin = makePin(100, 100, { fallen: true });
    for (let tick = 0; tick < 120; tick++) stepMinigamePhysics(null, [pin], lane);
    expect(pin.x).toBe(100);
    expect(pin.y).toBe(100);
    expect(pin.velocityY).toBe(0);
  });

  it('allows pin carry during settling regardless of rack order', () => {
    for (const reverse of [false, true]) {
      const moving = makePin(100, 100, { fallen: true, velocityX: 8 });
      const target = makePin(135, 100);
      const pins = reverse ? [target, moving] : [moving, target];
      const knocked: MinigamePin[] = [];
      for (let tick = 0; tick < 10; tick++) knocked.push(...stepMinigamePhysics(null, pins, lane));
      expect(knocked).toHaveLength(1);
      expect(target.fallen).toBe(true);
    }
  });

  it('handles a fast ball without tunnelling through the head pin', () => {
    const ball = makeBall({ y: 200, velocityY: -120 });
    const pin = makePin(140, 128);
    expect(stepMinigamePhysics(ball, [pin], lane)).toContain(pin);
  });

  it('produces deterministic results and rewards pocket hits over a central hit', () => {
    const first = makeRack();
    const second = makeRack();
    const pocket = makeRack();
    roll(makeBall({ velocityY: -10 }), first);
    roll(makeBall({ velocityY: -10 }), second);
    roll(makeBall({ x: 125, velocityY: -10 }), pocket);
    expect(first).toEqual(second);
    expect(pocket.filter((pin) => pin.fallen)).toHaveLength(10);
    expect(first.filter((pin) => pin.fallen).length).toBeLessThan(10);
  });
});