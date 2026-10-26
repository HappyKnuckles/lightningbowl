import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/** Never shorter than this, so a landscape phone still gets a usable lane (the page scrolls then). */
const MIN_HEIGHT_PX = 360;
/** Space kept below the element (its bottom margin). */
const BOTTOM_GAP_PX = 8;

/**
 * Caps the element's height (`max-height`) at the visible height of its `ion-content` below where it
 * starts, so it never runs off the screen when the page is scrolled to the top; give it a `height`
 * to fill that space. Follows resizes of the content and of everything above the element (e.g. a card
 * that appears once data has loaded).
 */
@Directive({
  selector: '[appFitScreen]',
})
export class FitScreenDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(async () => {
      const content = el.closest('ion-content');
      if (!content) {
        return;
      }
      const scroll = await content.getScrollElement();
      const update = () => {
        const top = el.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
        // the scroll area runs under a translucent header / tab bar and is padded for them
        const bottomPadding = parseFloat(getComputedStyle(scroll).paddingBottom) || 0;
        const available = scroll.clientHeight - top - bottomPadding - BOTTOM_GAP_PX;
        el.style.maxHeight = `${Math.max(MIN_HEIGHT_PX, Math.floor(available))}px`;
      };

      const observer = new ResizeObserver(update);
      observer.observe(scroll);
      let sibling = el.previousElementSibling;
      while (sibling) {
        observer.observe(sibling);
        sibling = sibling.previousElementSibling;
      }
      destroyRef.onDestroy(() => observer.disconnect());
      update();
    });
  }
}
