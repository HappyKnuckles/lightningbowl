import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, chevronBack, copyOutline, trashOutline } from 'ionicons/icons';
import { catchError, debounceTime, from, map, of, startWith, switchMap } from 'rxjs';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { PatternCalculation, PatternRow } from 'src/app/core/models/pattern.model';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import {
  calculationFacts,
  describeCalculatedRow,
  isBuffingRow,
  newPatternRow,
  PatternDraft,
  PatternRowDraft,
  PatternRowField,
  toPatternInput,
} from 'src/app/core/utils/pattern-utils/pattern-input.utils';

type Pass = 'forward' | 'reverse';

/** How long typing has to pause before the pattern is recalculated. */
const CALCULATE_DEBOUNCE_MS = 400;

interface Preview {
  calculating: boolean;
  calculation?: PatternCalculation;
  error?: string;
}

/**
 * Adds a custom pattern. The user enters it the way it's programmed on the lane machine (per row:
 * boards, loads, mics, speed, buffer, tank); the pattern API calculates the rest: oil and distance
 * of every row, totals, distance, ratio and the chart, shown live while typing. Saved patterns are
 * always in the "Custom Patterns" category.
 */
@Component({
  selector: 'app-pattern-form',
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    NgTemplateOutlet,
  ],
  templateUrl: './pattern-form.component.html',
  styleUrl: './pattern-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternFormComponent {
  readonly #patternService = inject(PatternService);
  readonly #patternsStore = inject(PatternsStore);
  readonly #toastService = inject(ToastService);
  readonly #modalCtrl = inject(ModalController);

  readonly title = signal('');
  readonly pump = signal('45');
  readonly tanks = signal('');
  readonly reverseStart = signal('');
  readonly forward = signal<PatternRowDraft[]>([newPatternRow(undefined, '45')]);
  readonly reverse = signal<PatternRowDraft[]>([]);
  readonly draft = computed<PatternDraft>(() => ({
    title: this.title(),
    pump: this.pump(),
    tanks: this.tanks(),
    reverseStart: this.reverseStart(),
    forward: this.forward(),
    reverse: this.reverse(),
  }));
  /** Last successful calculation, kept on screen while the next one runs or while the input has an error. */
  readonly #lastCalculation = signal<PatternCalculation | undefined>(undefined);

  /** The pattern as calculated by the API for what is entered so far, recalculated after typing pauses. */
  readonly preview = toSignal(
    toObservable(computed(() => toPatternInput({ ...this.draft(), title: '' }))).pipe(
      debounceTime(CALCULATE_DEBOUNCE_MS),
      switchMap((input) =>
        from(this.#patternService.calculatePattern(input)).pipe(
          map((calculation): Preview => ({ calculating: false, calculation })),
          catchError((error: Error) => of<Preview>({ calculating: false, error: error.message })),
          startWith<Preview>({ calculating: true }),
        ),
      ),
    ),
    { initialValue: { calculating: true } as Preview },
  );

  readonly calculation = computed(() => {
    const calculation = this.preview().calculation;
    return calculation ?? this.#lastCalculation();
  });

  readonly calculationError = computed(() => this.preview().error ?? null);
  readonly calculating = computed(() => this.preview().calculating);
  readonly facts = computed(() => {
    const calculation = this.calculation();
    return calculation ? calculationFacts(calculation) : [];
  });
  readonly chartPreview = computed(() => this.calculation()?.chart_standard ?? null);
  readonly forwardRows = computed(() => this.#rowViews(this.forward(), this.calculation()?.forwards_data));
  readonly reverseRows = computed(() => this.#rowViews(this.reverse(), this.calculation()?.reverse_data));

  readonly saving = signal(false);
  /** Saving needs a title and input the API could calculate (the current one, not a stale one). */
  readonly canSave = computed(() => this.title().trim().length > 0 && !!this.preview().calculation && !this.saving());

  readonly reverseStartPlaceholder = computed(() => {
    const forwardEnd = this.calculation()?.forwards_data.at(-1)?.distance_end;
    return forwardEnd ? `${forwardEnd} (end of forward)` : 'end of forward';
  });
  readonly saveError = signal<string | null>(null);

  constructor() {
    addIcons({ chevronBack, addOutline, copyOutline, trashOutline });
    // remember the last good calculation so the preview doesn't flicker away on a typo
    toObservable(this.preview).subscribe((preview) => {
      if (preview.calculation) this.#lastCalculation.set(preview.calculation);
    });
  }

  setValue(field: 'title' | 'pump' | 'tanks' | 'reverseStart', event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    this[field].set(value);
    this.saveError.set(null);
  }

  setRowValue(pass: Pass, key: number, field: PatternRowField, event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    this.#rows(pass).update((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    this.saveError.set(null);
  }

  /** A new row continues from the last one of its pass (or of the forward pass, for the first reverse row). */
  addRow(pass: Pass): void {
    const rows = this.#rows(pass)();
    const previous = rows.at(-1) ?? (pass === 'reverse' ? this.forward().at(-1) : undefined);
    this.#rows(pass).update((list) => [...list, newPatternRow(previous, this.pump())]);
  }

  duplicateRow(pass: Pass, key: number): void {
    this.#rows(pass).update((rows) => {
      const index = rows.findIndex((row) => row.key === key);
      return index === -1 ? rows : [...rows.slice(0, index + 1), newPatternRow(rows[index], this.pump()), ...rows.slice(index + 1)];
    });
  }

  removeRow(pass: Pass, key: number): void {
    this.#rows(pass).update((rows) => rows.filter((row) => row.key !== key));
  }

  cancel(): void {
    this.#modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const url = await this.#patternService.addPattern(toPatternInput(this.draft()));
      this.#toastService.showToast(TOAST_MESSAGES.patternAddSuccess, 'checkmark');
      void this.#patternsStore.loadAllPatterns(true);
      await this.#modalCtrl.dismiss({ url }, 'confirm');
    } catch (error) {
      this.saveError.set((error as Error).message);
      this.#toastService.showToast(TOAST_MESSAGES.patternAddError, 'bug', true);
    } finally {
      this.saving.set(false);
    }
  }

  #rows(pass: Pass) {
    return pass === 'forward' ? this.forward : this.reverse;
  }

  #rowViews(rows: PatternRowDraft[], calculated: PatternRow[] | undefined) {
    return rows.map((row, index) => ({
      row,
      number: index + 1,
      buffing: isBuffingRow(row),
      result: describeCalculatedRow(calculated?.[index]),
    }));
  }
}
