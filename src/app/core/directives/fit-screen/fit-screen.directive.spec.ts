import { vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IonContent } from '@ionic/angular/standalone';

import { FitScreenDirective } from './fit-screen.directive';

@Component({
  imports: [IonContent, FitScreenDirective],
  template: `
    <div style="height: 600px; display: flex; flex-direction: column">
      <ion-content>
        <div style="height: 100px"></div>
        <div appFitScreen id="fit"></div>
        <div style="height: 2000px"></div>
      </ion-content>
    </div>
  `,
})
class HostComponent {}

describe('FitScreenDirective', () => {
  it('caps the height at the visible content below where the element starts', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#fit')!;
    await vi.waitFor(() => expect(el.style.maxHeight).not.toBe(''), { timeout: 3000 });

    // 600 px of content, 100 px above, 8 px kept free below
    expect(el.style.maxHeight).toBe('492px');
    fixture.nativeElement.remove();
  });
});
