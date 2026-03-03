import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, chevronBack, close } from 'ionicons/icons';
import { startWith, combineLatestWith } from 'rxjs';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { ForwardsData, Pattern, ReverseData } from 'src/app/core/models/pattern.model';
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
    CommonModule,
    IonInput,
    IonItem,
    IonButton,
    IonIcon,
    ReactiveFormsModule,
  ],
  templateUrl: './pattern-form.component.html',
  styleUrl: './pattern-form.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PatternFormComponent implements OnInit {
  constructor(
    private fb: FormBuilder,
    private patternService: PatternService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private modalCtrl: ModalController,
  ) {
    addIcons({ chevronBack, trashOutline, close });
  }

  patternForm = this.fb.group({
    title: ['', Validators.required],
    category: 'Custom Patterns',
    distance: ['', Validators.required],
    ratio: ['', Validators.required],
    volume: ['', Validators.required],
    forward: ['', Validators.required],
    reverse: ['', Validators.required],
    pump: ['', Validators.required],
    tanks: [''],
    forwards_data: this.fb.array<FormControl<ForwardsData>>([]),
    reverse_data: this.fb.array<FormControl<ReverseData>>([]),
  });

  ngOnInit(): void {
    this.addForwardData();
    this.addReverseData();

    const forwardControl = this.patternForm.get('forward');
    const reverseControl = this.patternForm.get('reverse');
    const volumeControl = this.patternForm.get('volume');

    if (forwardControl) {
      forwardControl.valueChanges.subscribe((value) => {
        if (value !== null && value !== undefined) {
          forwardControl.setValue(parseFloat(value).toFixed(2), { emitEvent: false });
        }
      });
    }

    // Format Oil Reverse value
    if (reverseControl) {
      reverseControl.valueChanges.subscribe((value) => {
        if (value !== null && value !== undefined) {
          reverseControl.setValue(parseFloat(value).toFixed(2), { emitEvent: false });
        }
      });
    }

    // Format distance_start and distance_end for forwards_data
    this.forwardsDataArray.valueChanges.subscribe(() => {
      this.forwardsDataArray.controls.forEach((group) => {
        const distanceStartControl = group.get('distance_start');
        const distanceEndControl = group.get('distance_end');
        const totalOilControl = group.get('total_oil');

        if (distanceStartControl && distanceStartControl.value) {
          distanceStartControl.setValue(parseFloat(distanceStartControl.value).toFixed(2), { emitEvent: false });
        }

        if (distanceEndControl && distanceEndControl.value) {
          distanceEndControl.setValue(parseFloat(distanceEndControl.value).toFixed(2), { emitEvent: false });
        }
        if (totalOilControl && totalOilControl.value) {
          totalOilControl.setValue(parseFloat(totalOilControl.value).toFixed(3), { emitEvent: false });
        }
      });
    });

    // Format distance_start and distance_end for reverse_data
    this.reverseDataArray.valueChanges.subscribe(() => {
      this.reverseDataArray.controls.forEach((group) => {
        const distanceStartControl = group.get('distance_start');
        const distanceEndControl = group.get('distance_end');
        const totalOilControl = group.get('total_oil');

        if (distanceStartControl && distanceStartControl.value) {
          distanceStartControl.setValue(parseFloat(distanceStartControl.value).toFixed(2), { emitEvent: false });
        }

        if (distanceEndControl && distanceEndControl.value) {
          distanceEndControl.setValue(parseFloat(distanceEndControl.value).toFixed(2), { emitEvent: false });
        }

        if (totalOilControl && totalOilControl.value) {
          totalOilControl.setValue(parseFloat(totalOilControl.value).toFixed(3), { emitEvent: false });
        }
      });
    });

    if (forwardControl && reverseControl && volumeControl) {
      forwardControl.valueChanges
        .pipe(startWith(forwardControl.value ?? 0), combineLatestWith(reverseControl.valueChanges.pipe(startWith(reverseControl.value ?? 0))))
        .subscribe(([forward, reverse]) => {
          const forwardValue = Number(forward) || 0;
          const reverseValue = Number(reverse) || 0;
          volumeControl.setValue((forwardValue + reverseValue).toString(), { emitEvent: false });
        });
    }
  }

  get forwardsDataArray(): FormArray {
    return this.patternForm.get('forwards_data') as FormArray;
  }

  get reverseDataArray(): FormArray {
    return this.patternForm.get('reverse_data') as FormArray;
  }

  cancel(): void {
    this.patternForm.reset();
    this.modalCtrl.dismiss(null, 'cancel');
  }

  reset(): void {
    this.patternForm.reset();
    this.forwardsDataArray.clear();
    this.reverseDataArray.clear();
    this.addForwardData();
    this.addReverseData();
  }

  addForwardData(): void {
    this.addData(this.forwardsDataArray);
  }

  removeForwardData(index: number): void {
    this.removeData(this.forwardsDataArray, index);
  }

  addReverseData(): void {
    this.addData(this.reverseDataArray);
  }

  removeReverseData(index: number): void {
    this.removeData(this.reverseDataArray, index);
  }

  async onSubmit(): Promise<void> {
    if (!this.patternForm.valid) {
      return;
    }

    const ratio = this.patternForm.value.ratio + ':1';

    const pattern: Partial<Pattern> = {
      title: this.patternForm.value.title || '',
      category: this.patternForm.value.category || '',
      distance: (this.patternForm.value.distance || '').toString().replace(',', '.'),
      ratio: ratio,
      volume: (this.patternForm.value.volume || '').toString().replace(',', '.'),
      forward: (this.patternForm.value.forward || '').toString().replace(',', '.'),
      reverse: (this.patternForm.value.reverse || '').toString().replace(',', '.'),
      pump: (this.patternForm.value.pump || '').toString().replace(',', '.'),
      tanks: this.patternForm.value.tanks || '',
      forwards_data: this.patternForm.value.forwards_data!.map((data: any) => ({
        ...data,
        start: data.start.toUpperCase(),
        stop: data.stop.toUpperCase(),
        load: (data.load || '').toString().replace(',', '.'),
        mics: (data.mics || '').toString().replace(',', '.'),
        speed: (data.speed || '').toString().replace(',', '.'),
        buf: (data.buf || '').toString().replace(',', '.'),
        tank: (data.tank || '').toString().replace(',', '.'),
        total_oil: (data.total_oil || '').toString().replace(',', '.'),
        distance_start: (data.distance_start || '').toString().replace(',', '.'),
        distance_end: (data.distance_end || '').toString().replace(',', '.'),
      })),
      reverse_data: this.patternForm.value.reverse_data!.map((data: any) => ({
        ...data,
        start: data.start.toUpperCase(),
        stop: data.stop.toUpperCase(),
        load: (data.load || '').toString().replace(',', '.'),
        mics: (data.mics || '').toString().replace(',', '.'),
        speed: (data.speed || '').toString().replace(',', '.'),
        buf: (data.buf || '').toString().replace(',', '.'),
        tank: (data.tank || '').toString().replace(',', '.'),
        total_oil: (data.total_oil || '').toString().replace(',', '.'),
        distance_start: (data.distance_start || '').toString().replace(',', '.'),
        distance_end: (data.distance_end || '').toString().replace(',', '.'),
      })),
    };
    try {
      this.loadingService.setLoading(true);
      await this.patternService.addPattern(pattern);
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
      number: ['', Validators.required],
      start: ['', Validators.required],
      stop: ['', Validators.required],
      load: ['', Validators.required],
      mics: ['', Validators.required],
      speed: ['', Validators.required],
      buf: ['', Validators.required],
      tank: ['', Validators.required],
      total_oil: ['', Validators.required],
      distance_start: ['', Validators.required],
      distance_end: ['', Validators.required],
    });
  }

  private addData(array: FormArray): void {
    const newIndex = array.length + 1;
    const newGroup = this.createDataGroup();
    newGroup.get('number')?.setValue(newIndex);
    array.push(newGroup);
  }

  private removeData(array: FormArray, index: number): void {
    array.removeAt(index);
    this.updateIndices(array);
  }

  private updateIndices(array: FormArray): void {
    array.controls.forEach((group, index) => {
      group.get('number')?.setValue(index + 1);
    });
  }
}
