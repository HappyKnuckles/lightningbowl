import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { BallFilterService } from 'src/app/core/services/ball-filter/ball-filter.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BallService } from 'src/app/core/services/ball/ball.service';
import { CommonModule } from '@angular/common';
import { BallFilter, CoreType, CoverstockType, Market } from 'src/app/core/models/filter.model';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { ToastMessages } from 'src/app/core/constants/toast-messages.constants';
import { LoadingService } from 'src/app/core/services/loader/loading.service';
import { GenericTypeaheadComponent } from '../generic-typeahead/generic-typeahead.component';
import { createBallCoreTypeaheadConfig, createBallCoverstockTypeaheadConfig } from '../generic-typeahead/typeahead-configs';
import { TypeaheadConfig } from '../generic-typeahead/typeahead-config.interface';
import { Core, Coverstock } from 'src/app/core/models/ball.model';
import { AnalyticsService } from 'src/app/core/services/analytics/analytics.service';
@Component({
  selector: 'app-ball-filter',
  templateUrl: './ball-filter.component.html',
  styleUrls: ['./ball-filter.component.scss'],
  providers: [ModalController],
  imports: [
    FormsModule,
    IonList,
    IonFooter,
    IonToggle,
    IonModal,
    IonLabel,
    IonInput,
    IonButton,
    IonItem,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonSelect,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    IonSelectOption,
    GenericTypeaheadComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BallFilterComponent implements OnInit {
  markets: Market[] = [Market.ALL, Market.US, Market.INT];
  coreTypes: CoreType[] = [CoreType.ALL, CoreType.ASYMMETRIC, CoreType.SYMMETRIC];
  coverstockTypes: CoverstockType[] = Object.values(CoverstockType);
  weights: string[] = ['12', '13', '14', '15', '16'];
  presentingElement?: HTMLElement;
  coreTypeaheadConfig!: TypeaheadConfig<Core>;
  coverstockTypeaheadConfig!: TypeaheadConfig<Coverstock>;

  constructor(
    public ballFilterService: BallFilterService,
    private modalCtrl: ModalController,
    public ballService: BallService,
    private storageService: StorageService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private analyticsService: AnalyticsService,
  ) {}
  ngOnInit() {
    this.presentingElement = document.querySelector('.ion-page')!;
    this.coreTypeaheadConfig = createBallCoreTypeaheadConfig();
    this.coverstockTypeaheadConfig = createBallCoverstockTypeaheadConfig();
  }
  cancel(): Promise<boolean> {
    this.ballFilterService.filters.update(() =>
      localStorage.getItem('ball-filter') ? JSON.parse(localStorage.getItem('ball-filter')!) : this.ballFilterService.filters,
    );
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  reset(): void {
    this.ballFilterService.resetFilters();
  }

  async updateFilter<T extends keyof BallFilter>(key: T, value: unknown): Promise<void> {
    if (key === 'weight') {
      await this.changeWeight(value as number);
    }
    this.ballFilterService.filters.update((filters) => ({
      ...filters,
      [key]: value,
    }));
  }

  confirm(): Promise<boolean> {
    const activeFilters = this.ballFilterService.activeFilterCount();
    const filters = this.ballFilterService.filters();

    this.ballFilterService.filters.update((filters) => ({
      ...filters,
    }));
    this.ballFilterService.saveFilters();

    if (activeFilters > 0) {
      void this.analyticsService.trackBallFilterApplied({
        active_filter_count: activeFilters,
        has_brands: filters.brands.length > 0,
        has_cores: filters.cores.length > 0,
        has_coverstocks: filters.coverstocks.length > 0,
        has_core_type: filters.coreType !== CoreType.ALL,
        has_coverstock_types: filters.coverstockTypes.length > 0,
        has_market: filters.market !== Market.ALL,
        has_rg_range: filters.minRg > 0 || filters.maxRg < 999,
        has_diff_range: filters.minDiff > 0 || filters.maxDiff < 999,
        in_arsenal_only: filters.inArsenal,
      });
    }

    // this.ballFilterService.filterGames(this.games);
    return this.modalCtrl.dismiss('confirm');
  }

  async changeWeight(weight: number): Promise<void> {
    try {
      this.loadingService.setLoading(true);
      await this.storageService.loadAllBalls(undefined, weight);
    } catch (error) {
      console.error('Error loading balls:', error);
      this.toastService.showToast(ToastMessages.ballLoadError, 'bug', true);
    } finally {
      this.loadingService.setLoading(false);
    }
  }
}
