import { Injectable } from '@angular/core';
import { Frame, getThrowValue } from '../../models/game.model';

@Injectable({
  providedIn: 'root',
})
export class GameScoreCalculatorService {
  calculateScoreFromFrames(frames: Frame[]): { totalScore: number; frameScores: number[] } {
    if (!frames || frames.length === 0) {
      return { totalScore: 0, frameScores: [] };
    }

    let totalScore = 0;
    const frameScores: number[] = [];

    for (let i = 0; i < 10; i++) {
      const frame = frames[i];
      if (!frame || !frame.throws || frame.throws.length === 0) {
        frameScores.push(totalScore);
        continue;
      }

      const first = getThrowValue(frame, 0) ?? 0;
      const second = getThrowValue(frame, 1) ?? 0;

      if (i < 9) {
        // Frames 1-9
        if (first === 10) {
          // Strike
          const bonus = this.getStrikeBonus(frames, i);
          totalScore += 10 + bonus;
        } else if (first + second === 10) {
          // Spare
          const bonus = this.getSpareBonus(frames, i);
          totalScore += 10 + bonus;
        } else {
          // Open frame
          totalScore += first + second;
        }
      } else {
        // 10th frame - just sum all throws, no bonus calculation
        const third = getThrowValue(frame, 2) ?? 0;
        totalScore += first + second + third;
      }

      frameScores.push(totalScore);
    }

    return { totalScore, frameScores };
  }

  /**
   * Get strike bonus by looking at the next two throws across frames
   */
  private getStrikeBonus(frames: Frame[], frameIndex: number): number {
    const throwsNeeded: number[] = [];

    // Collect the next two throws
    for (let i = frameIndex + 1; i < frames.length && throwsNeeded.length < 2; i++) {
      const frame = frames[i];
      if (!frame || !frame.throws) continue;

      for (const t of frame.throws) {
        if (throwsNeeded.length < 2) {
          throwsNeeded.push(t.value);
        }
      }
    }

    return (throwsNeeded[0] ?? 0) + (throwsNeeded[1] ?? 0);
  }

  /**
   * Get spare bonus by looking at the next throw
   */
  private getSpareBonus(frames: Frame[], frameIndex: number): number {
    const nextFrame = frames[frameIndex + 1];
    return getThrowValue(nextFrame, 0) ?? 0;
  }

  /**
   * Calculate maximum possible score from current frame state
   */
  calculateMaxScoreFromFrames(frames: Frame[], currentTotalScore: number): number {
    let maxScore = 300;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!frame || !frame.throws || frame.throws.length === 0) {
        break;
      }

      const firstThrow = getThrowValue(frame, 0);
      const secondThrow = getThrowValue(frame, 1);

      if (firstThrow === undefined) break;

      // Handle frames 0-8 (non-final frames)
      if (i < 9) {
        if (i === 0) {
          if (secondThrow !== undefined) {
            if (firstThrow === 10) {
              continue;
            } else if (firstThrow + secondThrow === 10) {
              maxScore -= 10;
            } else {
              maxScore -= 30 - (firstThrow + secondThrow);
            }
          }
        } else {
          if (secondThrow !== undefined) {
            const prevFrame = frames[i - 1];
            const prevPrevFrame = i >= 2 ? frames[i - 2] : undefined;
            const isPrevStrike = getThrowValue(prevFrame, 0) === 10;
            const isPrevPrevStrike = getThrowValue(prevPrevFrame, 0) === 10;
            const prevFirst = getThrowValue(prevFrame, 0) ?? 0;
            const prevSecond = getThrowValue(prevFrame, 1) ?? 0;
            const isPrevSpare = prevFirst !== 10 && prevFirst + prevSecond === 10;

            if (i >= 2 && isPrevPrevStrike && isPrevStrike) {
              if (firstThrow + secondThrow === 10) {
                maxScore -= 30 - firstThrow;
              } else {
                maxScore -= 60 - (firstThrow + 2 * (firstThrow + secondThrow));
              }
              continue;
            }

            if (firstThrow !== 10) {
              if (isPrevStrike && firstThrow + secondThrow === 10) {
                maxScore -= 20;
              } else if (isPrevStrike && firstThrow + secondThrow !== 10) {
                maxScore -= 50 - 2 * (firstThrow + secondThrow);
              } else if (isPrevSpare && firstThrow + secondThrow === 10) {
                maxScore -= 20 - firstThrow;
              } else if (isPrevSpare && firstThrow + secondThrow !== 10) {
                maxScore -= 40 - (2 * firstThrow + secondThrow);
              } else if (!isPrevSpare && firstThrow + secondThrow === 10) {
                maxScore -= 10;
              } else if (!isPrevSpare && firstThrow === 10) {
                continue;
              } else {
                maxScore -= 30 - (firstThrow + secondThrow);
              }
            }
          }
        }
      } else {
        // 10th frame
        const thirdThrow = getThrowValue(frame, 2);
        if (thirdThrow !== undefined) {
          maxScore = currentTotalScore;
          continue;
        }

        const prevFrame = frames[i - 1];
        const prevPrevFrame = i >= 2 ? frames[i - 2] : undefined;
        const isPrevStrike = getThrowValue(prevFrame, 0) === 10;
        const isPrevPrevStrike = getThrowValue(prevPrevFrame, 0) === 10;
        const prevFirst = getThrowValue(prevFrame, 0) ?? 0;
        const prevSecond = getThrowValue(prevFrame, 1) ?? 0;
        const isPrevSpare = prevFirst !== 10 && prevFirst + prevSecond === 10;

        if (secondThrow !== undefined) {
          if (firstThrow === 10) {
            // Strike on first throw of 10th frame
            if (secondThrow === 10) {
              // Strike on second throw - pins reset, third throw can be 10
              // No reduction needed, max is still possible
            } else {
              // Non-strike on second throw - third throw limited to (10 - secondThrow)
              const maxThirdThrow = 10 - secondThrow;
              if (isPrevStrike) {
                maxScore -= 20 - secondThrow - maxThirdThrow;
              } else {
                maxScore -= 10 - maxThirdThrow;
              }
            }
          } else if (firstThrow + secondThrow !== 10) {
            maxScore = currentTotalScore;
          }
          continue;
        }

        if (isPrevSpare && !isPrevStrike) {
          if (firstThrow !== 10) {
            maxScore -= 20 - firstThrow;
          }
        } else if (!isPrevStrike && !isPrevSpare) {
          if (firstThrow !== 10) {
            maxScore -= 10;
          }
        } else if (isPrevPrevStrike && isPrevStrike && !isPrevSpare) {
          if (firstThrow !== 10) {
            maxScore -= 30 - firstThrow;
          }
        } else if (isPrevStrike && !isPrevSpare) {
          if (firstThrow !== 10) {
            maxScore -= 20;
          }
        }
      }
    }

    return maxScore;
  }
}
