import { TestBed } from '@angular/core/testing';

import { LetterTracingService } from './letter-tracing.service';

describe('LetterTracingService', () => {
  let service: LetterTracingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LetterTracingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
