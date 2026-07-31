import { ElementRef, Renderer2 } from '@angular/core';
import { HapticService } from '../../services/haptic/haptic.service';
import { LongPressDirective } from './long-press.directive';

describe('LongPressDirective', () => {
  it('should create an instance', () => {
    const hapticService = jasmine.createSpyObj<HapticService>('HapticService', ['vibrate']);
    const directive = new LongPressDirective(new ElementRef(document.createElement('div')), {} as Renderer2, hapticService);
    expect(directive).toBeTruthy();
  });
});
