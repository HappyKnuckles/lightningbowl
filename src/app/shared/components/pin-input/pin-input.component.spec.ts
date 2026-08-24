import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Ball } from 'src/app/core/models/ball.model';
import { ThrowBall } from 'src/app/core/models/game.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { makeBall } from 'src/testing/fixtures';
import { PinInputComponent } from './pin-input.component';

describe('PinInputComponent', () => {
  let component: PinInputComponent;
  let fixture: ComponentFixture<PinInputComponent>;

  const allBalls = signal<Ball[]>([]);
  const arsenal = signal<Ball[]>([]);
  const saveBallsToArsenal = vi.fn<(balls: Ball[]) => Promise<Ball[]>>();
  const showToast = vi.fn();

  beforeEach(async () => {
    allBalls.set([]);
    arsenal.set([]);
    saveBallsToArsenal.mockReset().mockResolvedValue([]);
    showToast.mockReset();

    await TestBed.configureTestingModule({
      imports: [PinInputComponent],
      providers: [
        { provide: BallsStore, useValue: { allBalls, arsenal, saveBallsToArsenal, url: '' } },
        { provide: ToastService, useValue: { showToast } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PinInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onBallAdd', () => {
    const iq = makeBall({ ball_id: 'b1', ball_name: 'IQ Tour', core_weight: '15' });
    const phaze = makeBall({ ball_id: 'b2', ball_name: 'Phaze II', core_weight: '15' });

    beforeEach(() => allBalls.set([iq, phaze]));

    it('saves every selected ball to the arsenal, not just the first', async () => {
      await component.onBallAdd(['b1', 'b2']);

      expect(saveBallsToArsenal).toHaveBeenCalledWith([iq, phaze]);
    });

    it('uses the ball straight away when only one was added', async () => {
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1']);

      expect(emitted).toEqual([{ name: 'IQ Tour', weight: '15' }]);
      expect(component.isBallModalOpen()).toBe(false);
    });

    it('asks which ball to use when several were added', async () => {
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1', 'b2']);

      expect(emitted).toEqual([]);
      expect(component.isBallModalOpen()).toBe(true);
    });

    it('still offers the balls that saved when one of them failed', async () => {
      saveBallsToArsenal.mockResolvedValue([phaze]);
      const emitted: (ThrowBall | undefined)[] = [];
      component.ballSelected.subscribe((ball) => emitted.push(ball));

      await component.onBallAdd(['b1', 'b2']);

      expect(emitted).toEqual([{ name: 'IQ Tour', weight: '15' }]);
    });

    it('does nothing when the selection matches no known ball', async () => {
      await component.onBallAdd(['nope']);

      expect(saveBallsToArsenal).not.toHaveBeenCalled();
    });
  });
});
