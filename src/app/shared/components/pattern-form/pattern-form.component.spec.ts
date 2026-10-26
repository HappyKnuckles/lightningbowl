import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { vi } from 'vitest';

import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';

import { PatternFormComponent } from './pattern-form.component';

const CALCULATION = {
  distance: "1.96'",
  ratio: '1.00:1',
  volume: '3.33',
  forward: '3.33',
  reverse: '0.00',
  chart_standard: 'data:image/svg+xml;base64,PHN2Zy8+',
  forwards_data: [
    {
      number: '1',
      start: '2L',
      stop: '2R',
      load: '2',
      mics: '45',
      speed: '14',
      buf: '3',
      tank: '',
      total_oil: '3.330',
      distance_start: '0.00',
      distance_end: '1.96',
    },
  ],
  reverse_data: [],
};

describe('PatternFormComponent', () => {
  let component: PatternFormComponent;
  let fixture: ComponentFixture<PatternFormComponent>;
  const patternService = { calculatePattern: vi.fn(), addPattern: vi.fn() };
  const modalCtrl = { dismiss: vi.fn().mockResolvedValue(true) };
  const toastService = { showToast: vi.fn() };
  const patternsStore = { loadAllPatterns: vi.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    vi.useFakeTimers();
    patternService.calculatePattern.mockReset().mockResolvedValue(CALCULATION);
    patternService.addPattern.mockReset().mockResolvedValue('new-url');
    modalCtrl.dismiss.mockClear();
    toastService.showToast.mockClear();

    await TestBed.configureTestingModule({
      imports: [PatternFormComponent],
      providers: [
        { provide: PatternService, useValue: patternService },
        { provide: ModalController, useValue: modalCtrl },
        { provide: ToastService, useValue: toastService },
        { provide: PatternsStore, useValue: patternsStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatternFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lets the edits reach the debounced calculation (effects run on change detection), then waits it out. */
  const settle = async () => {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
  };
  const typed = (value: string) => ({ detail: { value } }) as CustomEvent;

  it('starts with one forward row and shows what the API calculates for it', async () => {
    await settle();

    expect(patternService.calculatePattern).toHaveBeenCalledWith({
      pump: '45',
      forwards_data: [{ start: '2L', stop: '2R', load: 2, mics: 45, speed: 14, buf: 3 }],
      reverse_data: [],
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.preview-chart img')?.getAttribute('src')).toBe(CALCULATION.chart_standard);
    expect([...el.querySelectorAll('.fact-value')].map((v) => v.textContent?.trim())).toEqual(['1.96 ft', '1.00:1', '3.33 mL']);
    expect(el.querySelector('.row-result')?.textContent?.trim()).toBe('0.00 → 1.96 ft · 3.330 mL');
  });

  it("shows the API's message while the input can't be calculated", async () => {
    patternService.calculatePattern.mockRejectedValue(new Error('Forward row 1: speed is required'));
    component.setRowValue('forward', component.forward()[0].key, 'speed', typed(''));
    await settle();

    expect((fixture.nativeElement as HTMLElement).querySelector('.preview-error')?.textContent?.trim()).toBe('Forward row 1: speed is required');
    expect(component.canSave()).toBe(false);
  });

  it('recalculates once typing pauses', async () => {
    await settle();
    patternService.calculatePattern.mockClear();

    const key = component.forward()[0].key;
    component.setRowValue('forward', key, 'load', typed('3'));
    component.setRowValue('forward', key, 'load', typed('4'));
    await settle();

    expect(patternService.calculatePattern).toHaveBeenCalledTimes(1);
    expect(patternService.calculatePattern.mock.calls[0][0].forwards_data[0].load).toBe(4);
  });

  it('adds rows that continue from the previous one, and asks buffing rows where they end', async () => {
    const key = component.forward()[0].key;
    component.setRowValue('forward', key, 'start', typed('10L'));
    component.addRow('forward');
    component.addRow('reverse');
    fixture.detectChanges();

    expect(component.forward().map((r) => r.start)).toEqual(['10L', '10L']);
    expect(component.reverse()[0].start).toBe('10L');

    component.setRowValue('forward', component.forward()[1].key, 'load', typed('0'));
    fixture.detectChanges();
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row-card')[1].querySelectorAll('ion-input')].map((i) =>
      i.getAttribute('label'),
    );
    expect(labels).toContain('Ends at (ft)');

    component.removeRow('forward', key);
    expect(component.forward().length).toBe(1);
  });

  it('saves with a title once the pattern calculates, then closes', async () => {
    await settle();
    expect(component.canSave()).toBe(false);

    component.setValue('title', typed('House shot'));
    await settle();
    expect(component.canSave()).toBe(true);

    await component.save();

    expect(patternService.addPattern.mock.calls[0][0]).toMatchObject({ title: 'House shot', pump: '45' });
    expect(toastService.showToast).toHaveBeenCalled();
    expect(modalCtrl.dismiss).toHaveBeenCalledWith({ url: 'new-url' }, 'confirm');
  });

  it('keeps the form open with the reason when saving fails', async () => {
    patternService.addPattern.mockRejectedValue(new Error('Title contains inappropriate language'));
    component.setValue('title', typed('x'));
    await settle();

    await component.save();
    fixture.detectChanges();

    expect(modalCtrl.dismiss).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.save-error')?.textContent?.trim()).toBe('Title contains inappropriate language');
  });
});
