import { TestBed } from '@angular/core/testing';

import { TypeaheadConfigService } from './typeahead-config.service';

describe('TypeaheadConfigService', () => {
  let service: TypeaheadConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TypeaheadConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
