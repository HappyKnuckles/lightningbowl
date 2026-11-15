import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { vi } from 'vitest';

import { Arsenal } from 'src/app/core/models/ball.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

import { ArsenalPickerService } from './arsenal-picker.service';

describe('ArsenalPickerService', () => {
  let service: ArsenalPickerService;
  const league: Arsenal = { id: 'a1', name: 'League', ballIds: [] };
  const tournament: Arsenal = { id: 'a2', name: 'Tournament', ballIds: [] };
  const arsenals = signal<Arsenal[]>([]);
  const currentArsenal = signal<Arsenal | undefined>(undefined);
  let dismissal: { data?: { values?: string[] }; role?: string };
  const create = vi.fn();

  beforeEach(() => {
    arsenals.set([league, tournament]);
    currentArsenal.set(tournament);
    dismissal = { role: 'cancel' };
    create
      .mockReset()
      .mockImplementation(() => Promise.resolve({ present: () => Promise.resolve(), onDidDismiss: () => Promise.resolve(dismissal) }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AlertController, useValue: { create } },
        { provide: BallsStore, useValue: { arsenals, currentArsenal } },
      ],
    });
    service = TestBed.inject(ArsenalPickerService);
  });

  it('does not ask with a single arsenal', async () => {
    arsenals.set([league]);
    currentArsenal.set(league);

    expect(await service.chooseForNewBalls()).toEqual(['a1']);
    expect(create).not.toHaveBeenCalled();
  });

  it('asks with the open arsenal ticked and returns what was picked', async () => {
    dismissal = { role: 'confirm', data: { values: ['a1', 'a2'] } };

    expect(await service.chooseForNewBalls()).toEqual(['a1', 'a2']);
    const { inputs } = create.mock.calls[0][0];
    expect(inputs.map((input: { checked: boolean; label: string }) => [input.label, input.checked])).toEqual([
      ['League', false],
      ['Tournament', true],
    ]);
  });

  it('returns null when cancelled', async () => {
    expect(await service.chooseForNewBalls()).toBeNull();
  });

  it('cannot be confirmed with nothing ticked', async () => {
    await service.choose('Arsenals', ['a1']);

    const confirm = create.mock.calls[0][0].buttons[1];
    expect(confirm.handler([])).toBe(false);
    expect(confirm.handler(['a1'])).toBe(true);
  });
});
