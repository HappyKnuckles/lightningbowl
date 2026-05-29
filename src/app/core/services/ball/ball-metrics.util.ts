import { Ball, BallMetrics, BallTraits } from 'src/app/core/models/ball.model';

function getBallTraits(ball: Ball): BallTraits {
  const rg = parseFloat(ball.core_rg);
  const diff = parseFloat(ball.core_diff);
  const coverstockType = (ball.coverstock_type || '').toLowerCase();
  const factoryFinish = (ball.factory_finish || '').toLowerCase();

  const isPlastic = coverstockType.includes('plastic') || coverstockType.includes('polyester');
  const isUrethane = coverstockType.includes('urethane');
  const isSolid = coverstockType.includes('solid') && !isPlastic && !isUrethane;
  const isHybrid = coverstockType.includes('hybrid');
  const isPearl = coverstockType.includes('pearl');

  const gritMatch = factoryFinish.match(/(\d{3,4})(?:\s*[-\s]?grit)?/i);
  const finishGrit = gritMatch ? parseInt(gritMatch[1], 10) : null;
  const isPolished = ['polish', 'shine', 'gloss'].some((traits) => factoryFinish.includes(traits));

  return { isPlastic, isUrethane, isSolid, isHybrid, isPearl, finishGrit, isPolished, rg, diff };
}

export function getHookScore(ball: Ball): number {
  const traits = getBallTraits(ball);

  let base: number;
  if (traits.isSolid) base = 68;
  else if (traits.isHybrid) base = 55;
  else if (traits.isPearl) base = 44;
  else if (traits.isUrethane) base = 35;
  else if (traits.isPlastic) base = 7;
  else base = 44;

  if (!traits.isPlastic) {
    if (traits.finishGrit !== null) {
      if (traits.finishGrit <= 500) base = Math.min(100, base + 9);
      else if (traits.finishGrit <= 1000) base = Math.min(100, base + 5);
      else if (traits.finishGrit <= 2000) base = Math.min(100, base + 1);
      else if (traits.finishGrit >= 4000) base = Math.max(0, base - 4);
    }
    if (traits.isPolished) base = Math.max(0, base - 8);
  }

  if (!traits.isPlastic && !isNaN(traits.diff)) {
    const range = traits.isUrethane ? { min: 0.01, max: 0.05, weight: 8 } : { min: 0.02, max: 0.055, weight: 14 };
    const diffNorm = Math.min(1, Math.max(0, (traits.diff - range.min) / (range.max - range.min)));
    base = Math.round(Math.min(100, Math.max(0, base + (diffNorm - 0.5) * range.weight)));
  }

  return Math.max(0, Math.min(traits.isPlastic ? 20 : 90, base));
}

export function getLengthScore(ball: Ball): number {
  const traits = getBallTraits(ball);

  let base: number;
  if (traits.isSolid) base = 35;
  else if (traits.isHybrid) base = 50;
  else if (traits.isPearl) base = 65;
  else if (traits.isUrethane) base = 42;
  else if (traits.isPlastic) base = 92;
  else base = 52;

  if (!traits.isPlastic && !isNaN(traits.rg)) {
    const rgNorm = Math.min(1, Math.max(0, (traits.rg - 2.45) / (2.7 - 2.45)));
    base = Math.round(base + (rgNorm - 0.5) * 20);
  }

  if (!traits.isPlastic) {
    if (traits.finishGrit !== null) {
      if (traits.finishGrit <= 500) base = Math.max(0, base - 8);
      else if (traits.finishGrit <= 1000) base = Math.max(0, base - 4);
      else if (traits.finishGrit >= 4000) base = Math.min(100, base + 5);
    }
    if (traits.isPolished) base = Math.min(100, base + 10);
  }

  return Math.max(0, Math.min(100, Math.round(base)));
}

export function getFlareScore(ball: Ball): number {
  const traits = getBallTraits(ball);

  if (traits.isPlastic) return 5;
  if (traits.isUrethane) {
    return !isNaN(traits.diff) ? Math.round(Math.min(100, Math.max(0, ((traits.diff - 0.005) / (0.06 - 0.005)) * 100))) : 20;
  }
  return !isNaN(traits.diff) ? Math.round(Math.min(100, Math.max(0, ((traits.diff - 0.015) / (0.06 - 0.015)) * 100))) : 50;
}

export function getHookLabel(input: Ball | number): string {
  const score = typeof input === 'number' ? input : getHookScore(input);
  if (score >= 75) return 'Very Strong';
  if (score >= 55) return 'Strong';
  if (score >= 35) return 'Medium';
  if (score >= 18) return 'Weak';
  return 'Very Weak';
}

export function getLengthLabel(input: Ball | number): string {
  const score = typeof input === 'number' ? input : getLengthScore(input);
  if (score >= 70) return 'Late Roll';
  if (score >= 40) return 'Medium Roll';
  return 'Early Roll';
}

export function getFlareLabel(input: Ball | number): string {
  const score = typeof input === 'number' ? input : getFlareScore(input);
  if (score >= 70) return 'High Flare';
  if (score >= 40) return 'Medium Flare';
  return 'Low Flare';
}

export function getLaneCondition(hookScore: number, lengthScore: number, flareScore: number): { laneCondition: string; laneConditionColor: string } {
  const combined = hookScore * 0.5 + flareScore * 0.3 + (100 - lengthScore) * 0.2;
  if (combined >= 60) return { laneCondition: 'Heavy Oil', laneConditionColor: 'primary' };
  if (combined <= 30) return { laneCondition: 'Dry / Light Oil', laneConditionColor: 'danger' };
  return { laneCondition: 'Medium Oil', laneConditionColor: 'warning' };
}

// Convenience wrapper für den Vollausstattung-Fall
export function getBallMetrics(ball: Ball): BallMetrics {
  const hookScore = getHookScore(ball);
  const lengthScore = getLengthScore(ball);
  const flareScore = getFlareScore(ball);
  const lane = getLaneCondition(hookScore, lengthScore, flareScore);

  return {
    hookScore,
    lengthScore,
    flareScore,
    hookLabel: getHookLabel(hookScore),
    lengthLabel: getLengthLabel(lengthScore),
    flareLabel: getFlareLabel(flareScore),
    ...lane,
  };
}
