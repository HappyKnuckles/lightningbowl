import { TestBed } from '@angular/core/testing';

import { ChartGenerationService } from './chart-generation.service';

describe('ChartService', () => {
  let service: ChartGenerationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChartGenerationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
