import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccordionDelayedCloseDirective } from './accordion-delayed-close.directive';

describe('AccordionDelayedCloseDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ElementRef, useValue: new ElementRef(document.createElement('ion-accordion-group')) }],
    });

    // The directive injects ElementRef in a field initializer, so it needs an injection context.
    const directive = TestBed.runInInjectionContext(() => new AccordionDelayedCloseDirective());
    expect(directive).toBeTruthy();
  });
});
