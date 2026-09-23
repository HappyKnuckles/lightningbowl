import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ball } from 'src/app/core/models/ball.model';
import { Game } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeBall, makeGame } from 'src/testing/fixtures';
import { ArsenalPage } from './arsenal.page';

describe('ArsenalPage', () => {
  let component: ArsenalPage;
  let fixture: ComponentFixture<ArsenalPage>;

  const arsenal = signal<Ball[]>([]);
  const allBalls = signal<Ball[]>([]);
  const games = signal<Game[]>([]);

  beforeEach(() => {
    arsenal.set([]);
    allBalls.set([]);
    games.set([]);

    TestBed.configureTestingModule({
      providers: [
        { provide: BallsStore, useValue: { arsenal, allBalls, url: '' } },
        { provide: GamesStore, useValue: { games } },
      ],
    });

    fixture = TestBed.createComponent(ArsenalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ballStats', () => {
    const hammer = makeBall({ ball_id: 'b1', ball_name: 'Hammer', core_weight: '15' });
    const iq = makeBall({ ball_id: 'b2', ball_name: 'IQ Tour', core_weight: '15' });

    it('leaves out balls that are no longer in the arsenal', () => {
      arsenal.set([hammer]);
      allBalls.set([hammer, iq]);
      games.set([
        makeGame({ gameId: 'g1', totalScore: 200, balls: ['Hammer15'] }),
        makeGame({ gameId: 'g2', totalScore: 180, balls: ['IQ Tour15'] }),
      ]);

      expect(component.ballStats().map((stats) => stats.name)).toEqual(['Hammer']);
    });

    it('includes an owned ball that has never been thrown', () => {
      arsenal.set([hammer, iq]);
      allBalls.set([hammer, iq]);
      games.set([makeGame({ gameId: 'g1', totalScore: 200, balls: ['Hammer15'] })]);

      const never = component.ballStats().find((stats) => stats.name === 'IQ Tour');

      expect(never).toBeDefined();
      expect(never?.gameCount).toBe(0);
    });

    it('does not list an owned ball twice once it has been thrown', () => {
      arsenal.set([hammer]);
      allBalls.set([hammer]);
      games.set([makeGame({ gameId: 'g1', totalScore: 200, balls: ['Hammer15'] })]);

      const stats = component.ballStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].gameCount).toBe(1);
    });

    it('ignores the game filter so the numbers cover all time', () => {
      arsenal.set([hammer]);
      allBalls.set([hammer]);
      games.set([
        makeGame({ gameId: 'g1', totalScore: 200, balls: ['Hammer15'], isPractice: true }),
        makeGame({ gameId: 'g2', totalScore: 100, balls: ['Hammer15'], league: 'Monday' }),
      ]);

      expect(component.ballStats()[0].gameCount).toBe(2);
    });
  });
});
