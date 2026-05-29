import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[appAccordionDelayedClose]',
  standalone: true,
  exportAs: 'accordionDelayedClose',
})
export class AccordionDelayedCloseDirective implements OnDestroy {
  private elementRef = inject<ElementRef<HTMLElement & { value?: string | string[] }>>(ElementRef);

  private visibleMap: Record<string, boolean> = {};
  private closeTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private readonly closeDelay = 500;

  @HostListener('ionChange', ['$event'])
  onAccordionChange(event: CustomEvent): void {
    const openIds: string[] = event.detail?.value ?? [];

    // Newly opened: cancel pending close, mark visible
    for (const id of openIds) {
      const pending = this.closeTimers[id];
      if (pending) {
        clearTimeout(pending);
        delete this.closeTimers[id];
      }
      this.visibleMap[id] = true;
    }

    // Existing entries no longer open: schedule delayed hide
    for (const id of Object.keys(this.visibleMap)) {
      if (openIds.includes(id) || this.closeTimers[id]) continue;

      this.closeTimers[id] = setTimeout(() => {
        if (!this.getOpenIds().includes(id)) {
          this.visibleMap[id] = false;
        }
        delete this.closeTimers[id];
      }, this.closeDelay);
    }
  }

  ngOnDestroy(): void {
    for (const timer of Object.values(this.closeTimers)) {
      clearTimeout(timer);
    }
    this.closeTimers = {};
  }

  isVisible(id: string): boolean {
    return !!this.visibleMap[id];
  }

  markVisible(id: string): void {
    const pending = this.closeTimers[id];
    if (pending) {
      clearTimeout(pending);
      delete this.closeTimers[id];
    }
    this.visibleMap[id] = true;
  }

  clear(id: string): void {
    const pending = this.closeTimers[id];
    if (pending) {
      clearTimeout(pending);
      delete this.closeTimers[id];
    }
    delete this.visibleMap[id];
  }

  private getOpenIds(): string[] {
    const value = this.elementRef.nativeElement.value;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
  }
}
