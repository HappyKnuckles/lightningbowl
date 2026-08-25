import { TestBed } from '@angular/core/testing';

import { HiddenLeagueSelectionService } from './hidden-league.service';

describe('HiddenLeagueService', () => {
  let service: HiddenLeagueSelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HiddenLeagueSelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
