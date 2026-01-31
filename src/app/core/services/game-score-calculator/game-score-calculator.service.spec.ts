import { TestBed } from '@angular/core/testing';

import { GameScoreCalculatorService } from './game-score-calculator.service';

describe('BowlingCalculatorService', () => {
  let service: GameScoreCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameScoreCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // it('should calculate max score for a full game with various scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;

  //   service.frames = [
  //     [10], // Frame 1: Strike
  //     [5, 5], // Frame 2: Spare
  //     [3, 4], // Frame 3: Open frame
  //     [10], // Frame 4: Strike
  //     [7, 2], // Frame 5: Open frame
  //     [3, 7], // Frame 6: Spare Fehler??
  //     [10], // Frame 7: Strike
  //     [10], // Frame 8: Strike
  //     [9, 1], // Frame 9: Spare
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [300, 280, 250, 250, 218, 208, 208, 208, 187, 177];

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate max score for a full game with good scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [10], // Frame 1: Strike
  //     [9, 1], // Frame 2: Spare
  //     [10], // Frame 3: Open frame
  //     [10], // Frame 4: Strike
  //     [9, 1], // Frame 5: Open frame
  //     [9, 1], // Frame 6: Spare
  //     [10], // Frame 7: Strike
  //     [5, 0], // Frame 8: Strike
  //     [5, 5], // Frame 9: Spare
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [300, 280, 280, 280, 259, 248, 248, 208, 198, 198, 188]; // Website
  //   // const expectedMaxScores = [300, 280, 280, 280, 259, 248, 248, 208, 198, 198, 188]; // App

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate max score for a full game with random1 scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [9, 1], // Frame 1: Spare
  //     [9, 1], // Frame 2: Spare
  //     [9, 1], // Frame 3: Spare
  //     [9, 1], // Frame 4: Spare
  //     [9, 1], // Frame 5: Spare
  //     [9, 1], // Frame 6: Spare
  //     [9, 1], // Frame 7: Spare
  //     [9, 1], // Frame 8: Spare
  //     [9, 1], // Frame 9: Spare
  //     // [9, 1, 1]         // Frame 9: Spare
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [290, 279, 268, 257, 246, 235, 224, 213, 202, 182]; // Website
  //   // const expectedMaxScores = [300, 280, 280, 280, 259, 248, 248, 208, 198, 198, 188]; // App

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate max score for a full game with random2 scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [10], // Frame 1: Strike
  //     [9, 1], // Frame 2: Spare
  //     [5, 4], // Frame 3: Open frame
  //     [10], // Frame 4: Strike
  //     [10], // Frame 5: Strike
  //     [8, 1], // Frame 6: Open frame
  //     [10], // Frame 7: Strike
  //     [5, 0], // Frame 8: Open frame
  //     [9, 1], // Frame 9: Spare
  //     // [10, 10, 10]
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [300, 280, 254, 254, 254, 220, 220, 180, 170, 170]; // Website
  //   // const expectedMaxScores = [300, 280, 280, 280, 259, 248, 248, 208, 198, 198, 188]; // App

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate max score for a full game with random3 scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [8, 1], // Frame 1: Open frame
  //     [6, 4], // Frame 2: Spare
  //     [10], // Frame 3: Strike
  //     [7, 2], // Frame 4: Open frame
  //     [10], // Frame 5: Strike
  //     [5, 4], // Frame 6: Open frame
  //     [9, 0], // Frame 7: Open frame
  //     [9, 1], // Frame 8: Spare
  //     [10], // Frame 9: Strike
  //     // [10, 10, 10]
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [279, 269, 269, 237, 237, 205, 184, 174, 174, 174, 174]; // Website
  //   // const expectedMaxScores = [300, 280, 280, 280, 259, 248, 248, 208, 198, 198, 188]; // App

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate max score for a full game with random4 scenarios', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [4, 3], // Frame 1: Open frame
  //     [5, 2], // Frame 2: Open frame
  //     [3, 6], // Frame 3: Open frame
  //     [2, 1], // Frame 4: Open frame
  //     [7, 1], // Frame 5: Open frame
  //     [8, 0], // Frame 6: Open frame
  //     [6, 2], // Frame 7: Open frame
  //     [3, 4], // Frame 8: Open frame
  //     [4, 1], // Frame 9: Open frame
  //     // [2, 3] // Frame 10: Open frame
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [277, 254, 233, 206, 184, 162, 140, 117, 92, 67];

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  // it('should calculate 300', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10, 10, 10], // Frame 1: Open frame
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [300, 300, 300, 300, 300, 300, 300, 300, 300, 300];

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });
  // it('should calculate 300', () => {
  //   // Simulate a full game with various scenarios
  //   service.maxScore = 300;
  //   service.frames = [
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [10], // Frame 1: Open frame
  //     [9, 1, 10], // Frame 1: Open frame
  //   ];

  //   // Expected max score after each frame
  //   const expectedMaxScores = [300, 300, 300, 300, 300, 300, 300, 300, 300, 279];

  //   // Calculate and verify the max score after each frame
  //   for (let i = 0; i < service.frames.length; i++) {
  //     expect(service.calculateMaxScore()).toBe(expectedMaxScores[i]);
  //   }
  // });

  describe('10th frame bonus throw max score calculation', () => {
    it('should correctly calculate max score when 10th frame has strike then non-strike', () => {
      // Scenario: 9 strikes, then 10th frame is X, 9, ?
      // The third throw can only knock down 1 pin (10 - 9 = 1)
      // Not 10 pins as the bug assumed
      const frames = [
        { frameIndex: 1, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 2, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 3, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 4, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 5, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 6, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 7, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 8, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 9, throws: [{ value: 10, throwIndex: 1 }] },
        {
          frameIndex: 10,
          throws: [
            { value: 10, throwIndex: 1 }, // Strike
            { value: 9, throwIndex: 2 }, // 9 pins
          ],
        },
      ];

      const result = service.calculateScoreFromFrames(frames);
      const currentScore = result.totalScore; // Should be 19 for incomplete 10th frame

      const maxScore = service.calculateMaxScoreFromFrames(frames, currentScore);

      // Max possible total score should be current score + max 3rd throw (1 pin)
      // Total frames 1-9: 9*30 = 270 (all strikes with strike bonuses)
      // Frame 10 so far: 10 + 9 = 19
      // Frame 10 max: 10 + 9 + 1 = 20 (third throw can only be 1 pin)
      // Expected max: 270 + 20 = 290
      expect(maxScore).toBe(290);
    });

    it('should correctly calculate max score when 10th frame has strike, then 5 pins', () => {
      // Scenario: 10th frame is X, 5, ?
      // The third throw can knock down at most 5 pins (10 - 5 = 5)
      const frames = [
        { frameIndex: 1, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 2, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 3, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 4, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 5, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 6, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 7, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 8, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 9, throws: [{ value: 10, throwIndex: 1 }] },
        {
          frameIndex: 10,
          throws: [
            { value: 10, throwIndex: 1 }, // Strike
            { value: 5, throwIndex: 2 }, // 5 pins
          ],
        },
      ];

      const result = service.calculateScoreFromFrames(frames);
      const currentScore = result.totalScore;

      const maxScore = service.calculateMaxScoreFromFrames(frames, currentScore);

      // Max possible: Frame 10 max = 10 + 5 + 5 = 20
      // Expected max total: 270 + 20 = 290
      expect(maxScore).toBe(290);
    });

    it('should correctly calculate max score when 10th frame has two strikes', () => {
      // Scenario: 10th frame is X, X, ?
      // The third throw can knock down all 10 pins (pins reset after strike)
      const frames = [
        { frameIndex: 1, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 2, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 3, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 4, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 5, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 6, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 7, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 8, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 9, throws: [{ value: 10, throwIndex: 1 }] },
        {
          frameIndex: 10,
          throws: [
            { value: 10, throwIndex: 1 }, // Strike
            { value: 10, throwIndex: 2 }, // Strike
          ],
        },
      ];

      const result = service.calculateScoreFromFrames(frames);
      const currentScore = result.totalScore;

      const maxScore = service.calculateMaxScoreFromFrames(frames, currentScore);

      // Max possible: 300 (perfect game)
      expect(maxScore).toBe(300);
    });

    it('should correctly calculate max score when 10th frame has spare', () => {
      // Scenario: 10th frame is 9, /, ?
      // The third throw can knock down all 10 pins (pins reset after spare)
      const frames = [
        { frameIndex: 1, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 2, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 3, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 4, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 5, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 6, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 7, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 8, throws: [{ value: 10, throwIndex: 1 }] },
        { frameIndex: 9, throws: [{ value: 10, throwIndex: 1 }] },
        {
          frameIndex: 10,
          throws: [
            { value: 9, throwIndex: 1 }, // 9 pins
            { value: 1, throwIndex: 2 }, // Spare
          ],
        },
      ];

      const result = service.calculateScoreFromFrames(frames);
      const currentScore = result.totalScore;

      const maxScore = service.calculateMaxScoreFromFrames(frames, currentScore);

      // Frame 10 max = 9 + 1 + 10 = 20
      // Expected max total: 270 + 20 = 290
      expect(maxScore).toBe(290);
    });
  });
});
