import { Animation, createAnimation } from '@ionic/angular/lazy';

export const alertEnterAnimation = (baseEl: HTMLElement): Animation => {
  // try shadowRoot first (ion-modal uses shadow DOM in some builds), then fallback
  const root = (baseEl && (baseEl as any).shadowRoot) || baseEl;

  const backdropElement = (root && root.querySelector && root.querySelector('ion-backdrop')) || baseEl.querySelector('ion-backdrop');

  const wrapperElement =
    (root && root.querySelector && (root.querySelector('.modal-wrapper') || root.querySelector('.ion-overlay-wrapper'))) ||
    baseEl.querySelector('.modal-wrapper') ||
    baseEl.querySelector('.ion-overlay-wrapper');

  // backdrop animation
  const backdropAnimation = createAnimation()
    .addElement(backdropElement || baseEl)
    .fromTo('opacity', 0.01, 'var(--backdrop-opacity)')
    .beforeStyles({ 'pointer-events': 'none' })
    .afterClearStyles(['pointer-events']);

  // wrapper animation (only if found)
  const wrapperAnimation = createAnimation();
  if (wrapperElement) {
    // center the scale and hint to the browser to optimize
    (wrapperElement as HTMLElement).style.transformOrigin = 'center center';
    (wrapperElement as HTMLElement).style.willChange = 'transform, opacity';

    wrapperAnimation.addElement(wrapperElement).keyframes([
      { offset: 0, opacity: '0.01', transform: 'scale(1.1)' },
      { offset: 1, opacity: '1', transform: 'translateY(0px) scale(1)' },
    ]);
  }

  const baseAnimation = createAnimation().addElement(baseEl).easing('ease-in-out').duration(200);

  if (backdropElement) baseAnimation.addAnimation(backdropAnimation);
  if (wrapperElement) baseAnimation.addAnimation(wrapperAnimation);

  return baseAnimation;
};

export const alertLeaveAnimation = (baseEl: HTMLElement): Animation => {
  // try shadowRoot first (ion-modal uses shadow DOM in some builds), then fallback
  const root = (baseEl && (baseEl as any).shadowRoot) || baseEl;

  const backdropElement = (root && root.querySelector && root.querySelector('ion-backdrop')) || baseEl.querySelector('ion-backdrop');

  const wrapperElement =
    (root && root.querySelector && (root.querySelector('.modal-wrapper') || root.querySelector('.ion-overlay-wrapper'))) ||
    baseEl.querySelector('.modal-wrapper') ||
    baseEl.querySelector('.ion-overlay-wrapper');

  // backdrop animation
  const backdropAnimation = createAnimation()
    .addElement(backdropElement || baseEl)
    .fromTo('opacity', 'var(--backdrop-opacity)', 0)
    .beforeStyles({ 'pointer-events': 'none' })
    .afterClearStyles(['pointer-events']);

  // wrapper animation (only if found)
  const wrapperAnimation = createAnimation();
  if (wrapperElement) {
    (wrapperElement as HTMLElement).style.transformOrigin = 'center center';
    (wrapperElement as HTMLElement).style.willChange = 'transform, opacity';

    wrapperAnimation.addElement(wrapperElement).keyframes([
      { offset: 0, opacity: 0.99, transform: 'scale(1)' },
      { offset: 1, opacity: 0, transform: 'scale(0.9)' },
    ]);
  }

  const baseAnimation = createAnimation().addElement(baseEl).easing('ease-in-out').duration(200);

  if (backdropElement) baseAnimation.addAnimation(backdropAnimation);
  if (wrapperElement) baseAnimation.addAnimation(wrapperAnimation);

  return baseAnimation;
};
