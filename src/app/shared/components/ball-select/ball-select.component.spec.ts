import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Arsenal, Ball } from 'src/app/core/models/ball.model';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { makeBall, makeGame } from 'src/testing/fixtures';

import { BallSelectComponent } from './ball-select.component';

describe('BallSelectComponent', () => {
  let component: BallSelectComponent;
  let fixture: ComponentFixture<BallSelectComponent>;
  const arsenal = signal<Ball[]>([]);
  const games = signal<Game[]>([]);
  const currentArsenal = signal<Arsenal | undefined>(undefined);

  const zen = makeBall({ ball_id: 'z', ball_name: 'Zen', core_weight: '15', arsenalId: 'zen' });
  const first = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15', arsenalId: 'one' });
  const second = makeBall({ ball_id: 'p', ball_name: 'Phaze II', core_weight: '15', arsenalId: 'two' });

  function create(selected: ThrowBall[] = [], singleSelect = false): void {
    fixture = TestBed.createComponent(BallSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedBalls', selected);
    fixture.componentRef.setInput('singleSelect', singleSelect);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    arsenal.set([zen, first, second]);
    currentArsenal.set(undefined);
    games.set([]);
    await TestBed.configureTestingModule({
      imports: [BallSelectComponent],
      providers: [
        { provide: BallsStore, useValue: { arsenal, currentArsenal, url: '' } },
        { provide: GamesStore, useValue: { games } },
      ],
    }).compileComponents();
  });

  it("lists the open arsenal's balls first", () => {
    currentArsenal.set({ id: 'a1', name: 'Tournament', ballIds: ['two'] });
    create();

    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['two', 'zen', 'one']);
  });

  it('lists two of the same ball apart', () => {
    create();

    const twins = component.rows().map((row) => row.detail.split(' · ').pop());
    expect(twins.slice(1)).toEqual(['#1', '#2']);
    expect(fixture.nativeElement.textContent).toContain(' · #2');
  });

  it('leaves retired balls out, unless the selection came with one', () => {
    const retired = makeBall({ ball_id: 'r', ball_name: 'Old Faithful', core_weight: '15', arsenalId: 'old', retiredAt: 100 });
    arsenal.set([zen, retired]);

    create();
    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['zen']);

    create([{ name: 'Old Faithful', weight: '15', arsenalId: 'old' }]);
    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['zen', 'old']);
    // still listed after it's taken off, so it can be put back before confirming
    component.toggleBallSelection(retired);
    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['zen', 'old']);
    expect(component.rows()[1].detail).toContain('retired');
  });

  it('lists retired balls when asked to, e.g. to filter the history', () => {
    const retired = makeBall({ ball_id: 'r', ball_name: 'Old Faithful', core_weight: '15', arsenalId: 'old', retiredAt: 100 });
    arsenal.set([zen, retired]);
    fixture = TestBed.createComponent(BallSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedBalls', []);
    fixture.componentRef.setInput('includeRetired', true);
    fixture.detectChanges();

    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['zen', 'old']);
  });

  it('shows a nickname on the second line', () => {
    arsenal.set([{ ...zen, nickname: 'benchmark' }]);
    create();

    expect(component.rows()[0].detail).toBe('Test Brand · benchmark');
  });

  it('selects only the one that was picked, by its arsenal id', () => {
    create();
    const picked: ThrowBall[][] = [];
    component.ballSelect.subscribe((balls) => picked.push(balls));

    component.toggleBallSelection(second);
    component.confirmBallSelection();

    expect(picked).toEqual([[{ name: 'Phaze II', weight: '15', arsenalId: 'two' }]]);
    expect(component.rows().map((row) => row.selected)).toEqual([false, false, true]);
  });

  it('starts with the balls of the game selected and unselects on a second tap', () => {
    create([{ name: 'Phaze II', weight: '15', arsenalId: 'one' }]);
    expect(component.rows().map((row) => row.selected)).toEqual([false, true, false]);

    component.toggleBallSelection(first);

    expect(component.tempSelectedBalls).toEqual([]);
  });

  it('holds one ball at a time in single select', () => {
    create([], true);

    component.toggleBallSelection(zen);
    component.toggleBallSelection(second);

    expect(component.tempSelectedBalls).toEqual([{ name: 'Phaze II', weight: '15', arsenalId: 'two' }]);
  });

  it('puts the most thrown ball first, counting each of two of the same ball on its own', () => {
    games.set([
      makeGame({ gameId: 'g1', balls: [{ name: 'Phaze II', weight: '15', arsenalId: 'two' }] }),
      makeGame({ gameId: 'g2', balls: [{ name: 'Phaze II', weight: '15', arsenalId: 'two' }] }),
      makeGame({ gameId: 'g3', balls: [{ name: 'Zen', weight: '15', arsenalId: 'zen' }] }),
    ]);
    create();

    expect(component.rows().map((row) => row.ball.arsenalId)).toEqual(['two', 'zen', 'one']);
  });

  it('gives the selection it started with back on cancel', () => {
    const selected = [{ name: 'Zen', weight: '15', arsenalId: 'zen' }];
    create(selected);
    const picked: ThrowBall[][] = [];
    component.ballSelect.subscribe((balls) => picked.push(balls));

    component.toggleBallSelection(first);
    component.cancelBallSelection();

    expect(picked).toEqual([selected]);
  });
});
