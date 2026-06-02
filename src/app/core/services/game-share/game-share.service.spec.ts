import { TestBed } from '@angular/core/testing';

import { GameShareService } from './game-share.service';

describe('GameShareService', () => {
  let service: GameShareService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameShareService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
