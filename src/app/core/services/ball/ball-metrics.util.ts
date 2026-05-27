import { Ball } from '@models/ball.model';

export interface BallMetrics {
  hookScore: number;
  lengthScore: number;
  flareScore: number;
  hookLabel: string;
  lengthLabel: string;
  flareLabel: string;
  laneCondition: string;
  laneConditionColor: string;
}

export function getBallMetrics(ball: Ball): BallMetrics {
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
  const isPolished = ['polish', 'shine', 'gloss'].some((t) => factoryFinish.includes(t));

  let hookBase: number;
  if (isSolid) hookBase = 68;
  else if (isHybrid) hookBase = 55;
  else if (isPearl) hookBase = 44;
  else if (isUrethane) hookBase = 35;
  else if (isPlastic) hookBase = 7;
  else hookBase = 44;

  if (!isPlastic) {
    if (finishGrit !== null) {
      if (finishGrit <= 500) hookBase = Math.min(100, hookBase + 9);
      else if (finishGrit <= 1000) hookBase = Math.min(100, hookBase + 5);
      else if (finishGrit <= 2000) hookBase = Math.min(100, hookBase + 1);
      else if (finishGrit >= 4000) hookBase = Math.max(0, hookBase - 4);
    }
    if (isPolished) hookBase = Math.max(0, hookBase - 8);
  }

  if (!isPlastic && !isNaN(diff)) {
    const range = isUrethane ? { min: 0.01, max: 0.05, weight: 8 } : { min: 0.02, max: 0.055, weight: 14 };
    const diffNorm = Math.min(1, Math.max(0, (diff - range.min) / (range.max - range.min)));
    hookBase = Math.round(Math.min(100, Math.max(0, hookBase + (diffNorm - 0.5) * range.weight)));
  }

  const hookScore = Math.max(0, Math.min(isPlastic ? 20 : 90, hookBase));

  let lengthBase: number;
  if (isSolid) lengthBase = 35;
  else if (isHybrid) lengthBase = 50;
  else if (isPearl) lengthBase = 65;
  else if (isUrethane) lengthBase = 42;
  else if (isPlastic) lengthBase = 92;
  else lengthBase = 52;

  if (!isPlastic && !isNaN(rg)) {
    const rgNorm = Math.min(1, Math.max(0, (rg - 2.45) / (2.7 - 2.45)));
    lengthBase = Math.round(lengthBase + (rgNorm - 0.5) * 20);
  }

  if (!isPlastic) {
    if (finishGrit !== null) {
      if (finishGrit <= 500) lengthBase = Math.max(0, lengthBase - 8);
      else if (finishGrit <= 1000) lengthBase = Math.max(0, lengthBase - 4);
      else if (finishGrit >= 4000) lengthBase = Math.min(100, lengthBase + 5);
    }
    if (isPolished) lengthBase = Math.min(100, lengthBase + 10);
  }

  const lengthScore = Math.max(0, Math.min(100, Math.round(lengthBase)));

  let flareScore: number;
  if (isPlastic) {
    flareScore = 5;
  } else if (isUrethane) {
    flareScore = !isNaN(diff) ? Math.round(Math.min(100, Math.max(0, ((diff - 0.005) / (0.06 - 0.005)) * 100))) : 20;
  } else {
    flareScore = !isNaN(diff) ? Math.round(Math.min(100, Math.max(0, ((diff - 0.015) / (0.06 - 0.015)) * 100))) : 50;
  }

  const hookLabel =
    hookScore >= 75 ? 'Very Strong' : hookScore >= 55 ? 'Strong' : hookScore >= 35 ? 'Medium' : hookScore >= 18 ? 'Weak' : 'Very Weak';

  const lengthLabel = lengthScore >= 70 ? 'Late Roll' : lengthScore >= 40 ? 'Medium Roll' : 'Early Roll';

  const flareLabel = flareScore >= 70 ? 'High Flare' : flareScore >= 40 ? 'Medium Flare' : 'Low Flare';

  const combined = hookScore * 0.5 + flareScore * 0.3 + (100 - lengthScore) * 0.2;
  const laneCondition = combined >= 60 ? 'Heavy Oil' : combined <= 30 ? 'Dry / Light Oil' : 'Medium Oil';
  const laneConditionColor = combined >= 60 ? 'primary' : combined <= 30 ? 'danger' : 'warning';

  return { hookScore, lengthScore, flareScore, hookLabel, lengthLabel, flareLabel, laneCondition, laneConditionColor };
}
