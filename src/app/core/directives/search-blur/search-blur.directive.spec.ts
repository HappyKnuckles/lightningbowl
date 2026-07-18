import { ElementRef } from '@angular/core';
import { SearchBlurDirective } from './search-blur.directive';

describe('SearchBlurDirective', () => {
  it('should create an instance', () => {
    const directive = new SearchBlurDirective(new ElementRef(document.createElement('ion-searchbar')));
    expect(directive).toBeTruthy();
  });
});
