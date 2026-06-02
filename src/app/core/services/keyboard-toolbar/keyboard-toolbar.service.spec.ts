import { TestBed } from '@angular/core/testing';

import { KeyboardToolbarService } from './keyboard-toolbar.service';

describe('KeyboardToolbarService', () => {
  let service: KeyboardToolbarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeyboardToolbarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
