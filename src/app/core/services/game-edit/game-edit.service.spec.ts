import { TestBed } from '@angular/core/testing';

import { GameEditService } from './game-edit.service';

describe('GameEditService', () => {
  let service: GameEditService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameEditService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
