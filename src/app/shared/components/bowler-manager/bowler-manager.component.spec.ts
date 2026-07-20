import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { Bowler } from 'src/app/core/models/bowler.model';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { AppFacade } from 'src/app/core/stores/app.facade';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { BowlersStore } from 'src/app/core/stores/bowlers.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { BowlerManagerComponent } from './bowler-manager.component';

describe('BowlerManagerComponent', () => {
  let component: BowlerManagerComponent;
  let fixture: ComponentFixture<BowlerManagerComponent>;
  let bowlers: Bowler[];

  const mockBowlersStore = {
    bowlers: () => bowlers,
    activeBowlerId: () => 'b1',
    activeBowler: () => bowlers[0],
    defaultBowlerId: () => 'b1',
    hasMultipleBowlers: () => bowlers.length > 1,
    addBowler: jasmine.createSpy('addBowler').and.resolveTo({ bowlerId: 'new', name: 'New', createdAt: 0 }),
    updateBowler: jasmine.createSpy('updateBowler').and.resolveTo(),
    setActiveBowler: jasmine.createSpy('setActiveBowler'),
  };

  const mockGamesStore = {
    games: () => [
      { gameId: 'g1', bowlerId: 'b1' },
      { gameId: 'g2', bowlerId: 'b1' },
      { gameId: 'g3', bowlerId: 'b2' },
      { gameId: 'g4' }, // legacy game -> default bowler b1
    ],
  };

  const mockBallsStore = {
    arsenal: () => [{ ball_id: '1', core_weight: '15', bowlerIds: ['b2'] }],
  };

  const mockAppFacade = {
    deleteBowler: jasmine.createSpy('deleteBowler').and.resolveTo(),
    renameBowler: jasmine.createSpy('renameBowler').and.resolveTo(),
  };

  const mockToastService = {
    showToast: jasmine.createSpy('showToast'),
  };

  const mockAlertController = {
    create: jasmine.createSpy('create').and.resolveTo({ present: jasmine.createSpy('present') }),
  };

  beforeEach(async () => {
    bowlers = [
      { bowlerId: 'b1', name: 'Nico', createdAt: 1 },
      { bowlerId: 'b2', name: 'Partner', createdAt: 2 },
    ];
    mockAlertController.create.calls.reset();
    mockToastService.showToast.calls.reset();
    mockAppFacade.deleteBowler.calls.reset();

    await TestBed.configureTestingModule({
      imports: [BowlerManagerComponent],
      providers: [
        { provide: BowlersStore, useValue: mockBowlersStore },
        { provide: GamesStore, useValue: mockGamesStore },
        { provide: BallsStore, useValue: mockBallsStore },
        { provide: AppFacade, useValue: mockAppFacade },
        { provide: ToastService, useValue: mockToastService },
        { provide: AlertController, useValue: mockAlertController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BowlerManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts games per bowler, attributing legacy games to the default bowler', () => {
    expect(component.gameCounts()).toEqual({ b1: 3, b2: 1 });
  });

  it('counts arsenal balls per owning bowler', () => {
    expect(component.ballCounts()).toEqual({ b2: 1 });
  });

  it('blocks deleting the last bowler with a toast instead of an alert', async () => {
    bowlers = [{ bowlerId: 'b1', name: 'Nico', createdAt: 1 }];
    await component.openDeleteAlert(bowlers[0]);
    expect(mockToastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.lastBowlerDeleteError, 'bug', true);
    expect(mockAlertController.create).not.toHaveBeenCalled();
  });

  it('offers move/delete choices when the bowler owns data', async () => {
    await component.openDeleteAlert(bowlers[0]);
    const config = mockAlertController.create.calls.mostRecent().args[0];
    expect(config.message).toContain('3 games');
    expect(config.buttons.length).toBe(3);
  });

  it('shows a simple confirm when the bowler owns nothing', async () => {
    bowlers.push({ bowlerId: 'b3', name: 'Empty', createdAt: 3 });
    await component.openDeleteAlert(bowlers[2]);
    const config = mockAlertController.create.calls.mostRecent().args[0];
    expect(config.message).toContain('no games or balls');
    expect(config.buttons.length).toBe(2);
  });

  it('sets the active bowler on tap', () => {
    component.setActive(bowlers[1]);
    expect(mockBowlersStore.setActiveBowler).toHaveBeenCalledWith('b2');
  });
});
