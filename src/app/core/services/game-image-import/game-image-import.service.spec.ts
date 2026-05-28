import { TestBed } from '@angular/core/testing';

import { GameImageImportService } from './game-image-import.service';

describe('GameImageImportService', () => {
  let service: GameImageImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameImageImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
