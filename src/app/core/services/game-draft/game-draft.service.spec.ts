import { TestBed } from '@angular/core/testing';

import { GameDraftService } from './game-draft.service';

describe('GameDraftService', () => {
  let service: GameDraftService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameDraftService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
