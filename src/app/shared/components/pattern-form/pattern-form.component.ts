import { Component, CUSTOM_ELEMENTS_SCHEMA, computed, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonItem,
  IonInput,
  IonIcon,
  IonButtons,
  IonToolbar,
  IonHeader,
  IonTitle,
  IonContent,
  ModalController,
  IonFooter,
  IonGrid,
  IonRow,
  IonCol,
  IonListHeader,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, chevronBack } from 'ionicons/icons';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';

@Component({
  selector: 'app-pattern-form',
  imports: [
    IonFooter,
    IonContent,
    IonTitle,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonInput,
    IonItem,
    IonButton,
    IonIcon,
    IonGrid,
    IonRow,
    IonCol,
    IonListHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './pattern-form.component.html',
  styleUrl: './pattern-form.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PatternFormComponent {
  constructor(
    private fb: FormBuilder,
    private patternService: PatternService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private modalCtrl: ModalController,
  ) {
    addIcons({ chevronBack, trashOutline });
  }

  readonly patternForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    distance: ['', Validators.required],
    pump: ['', Validators.required],
    tanks: [''],
    forwards_data: this.fb.array([this.createDataGroup()]),
    reverse_data: this.fb.array([this.createDataGroup()]),
  });

  private readonly forwardCount = signal(1);
  private readonly reverseCount = signal(1);

  readonly forwardIndices = computed(() => Array.from({ length: this.forwardCount() }, (_, i) => i));

  readonly reverseIndices = computed(() => Array.from({ length: this.reverseCount() }, (_, i) => i));

  get forwardsDataArray(): FormArray {
    return this.patternForm.get('forwards_data') as FormArray;
  }

  get reverseDataArray(): FormArray {
    return this.patternForm.get('reverse_data') as FormArray;
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  reset(): void {
    this.patternForm.reset();
    this.forwardsDataArray.clear();
    this.reverseDataArray.clear();
    this.forwardsDataArray.push(this.createDataGroup());
    this.reverseDataArray.push(this.createDataGroup());
    this.forwardCount.set(1);
    this.reverseCount.set(1);
  }

  addForwardData(): void {
    this.forwardsDataArray.push(this.createDataGroup());
    this.forwardCount.update((n) => n + 1);
  }

  removeForwardData(index: number): void {
    if (this.forwardsDataArray.length <= 1) return;
    this.forwardsDataArray.removeAt(index);
    this.forwardCount.update((n) => n - 1);
  }

  addReverseData(): void {
    this.reverseDataArray.push(this.createDataGroup());
    this.reverseCount.update((n) => n + 1);
  }

  removeReverseData(index: number): void {
    if (this.reverseDataArray.length <= 1) return;
    this.reverseDataArray.removeAt(index);
    this.reverseCount.update((n) => n - 1);
  }

  async onSubmit(): Promise<void> {
    if (!this.patternForm.valid) return;

    const raw = this.patternForm.getRawValue();
    const n = (val: unknown) => (val ?? '').toString().replace(',', '.');
    const mapRow = (row: any) => ({
      start: (row.start ?? '').toUpperCase(),
      stop: (row.stop ?? '').toUpperCase(),
      load: parseFloat(n(row.load)),
      mics: parseFloat(n(row.mics)),
      speed: parseFloat(n(row.speed)),
      buf: parseFloat(n(row.buf)),
      tank: row.tank || '',
      total_oil: parseFloat(n(row.total_oil)),
      distance_start: n(row.distance_start),
      distance_end: n(row.distance_end),
    });

    const payload = {
      title: raw.title,
      distance: parseFloat(n(raw.distance)),
      pump: parseFloat(n(raw.pump)),
      tanks: raw.tanks || '',
      forwards_data: raw.forwards_data.map(mapRow),
      reverse_data: raw.reverse_data.map(mapRow),
    };

    try {
      this.loadingService.setLoading(true);
      await this.patternService.addPattern(payload as any);
      this.toastService.showToast(ToastMessages.patternAddSuccess, 'checkmark');
      this.cancel();
    } catch (error) {
      console.error('Error adding pattern:', error);
      this.toastService.showToast(ToastMessages.patternAddError, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }

  private createDataGroup(): FormGroup {
    return this.fb.group({
      start: ['', Validators.required],
      stop: ['', Validators.required],
      load: ['', Validators.required],
      mics: ['', Validators.required],
      speed: ['', Validators.required],
      buf: ['', Validators.required],
      tank: [''],
      total_oil: ['', Validators.required],
      distance_start: ['', Validators.required],
      distance_end: ['', Validators.required],
    });
  }
}
