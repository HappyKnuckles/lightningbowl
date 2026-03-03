import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { IonChip } from '@ionic/angular/standalone';
import { UtilsService } from 'src/app/core/services/utils/utils.service';

export interface FilterConfig {
  key: string;
  label?: string;
  type: 'boolean' | 'string' | 'number' | 'array' | 'date' | 'range' | 'enum';
  displayValue?: (value: unknown) => string;
  isRange?: boolean;
  rangeKeys?: {
    min: string;
    max: string;
  };
  suffix?: string;
  prefix?: string;
  enumValues?: Record<string, string>;
}

@Component({
  selector: 'app-generic-filter-active',
  imports: [IonChip, NgIf, NgFor, DatePipe],
  templateUrl: './generic-filter-active.component.html',
  styleUrl: './generic-filter-active.component.scss',
})
export class GenericFilterActiveComponent implements OnInit {
  @Input() filters: Record<string, unknown> = {};
  @Input() defaultFilters: Record<string, unknown> = {};
  @Input() filterConfigs: FilterConfig[] = [];
  @Input() title?: string;

  constructor(private utilsService: UtilsService) {}

  ngOnInit() {
    // Ensure we have valid inputs
    if (!this.filters || !this.defaultFilters || !this.filterConfigs) {
      console.warn('GenericFilterActiveComponent: Missing required inputs');
    }
  }

  isFilterActive(config: FilterConfig): boolean {
    const filterValue = this.filters[config.key];
    const defaultValue = this.defaultFilters[config.key];

    // Handle range filters
    if (config.isRange && config.rangeKeys) {
      const minValue = this.filters[config.rangeKeys.min];
      const maxValue = this.filters[config.rangeKeys.max];
      const defaultMinValue = this.defaultFilters[config.rangeKeys.min];
      const defaultMaxValue = this.defaultFilters[config.rangeKeys.max];

      return minValue !== defaultMinValue || maxValue !== defaultMaxValue;
    }

    // Handle different data types
    switch (config.type) {
      case 'date':
        return !this.utilsService.areDatesEqual(filterValue as string, defaultValue as string);
      case 'array': {
        const filterArray = Array.isArray(filterValue) ? filterValue : [];
        const defaultArray = Array.isArray(defaultValue) ? defaultValue : [];
        return !this.utilsService.areArraysEqual(filterArray, defaultArray);
      }
      case 'boolean':
      case 'string':
      case 'number':
      case 'enum':
      default:
        return filterValue !== defaultValue;
    }
  }

  getDisplayValue(config: FilterConfig): string {
    // Use custom display function if provided
    if (config.displayValue) {
      return config.displayValue(this.filters[config.key]);
    }

    const value = this.filters[config.key];
    const prefix = config.prefix || '';
    const suffix = config.suffix || '';

    // Handle range filters
    if (config.isRange && config.rangeKeys) {
      const minValue = this.filters[config.rangeKeys.min];
      const maxValue = this.filters[config.rangeKeys.max];
      return `${prefix}${minValue} - ${maxValue}${suffix}`;
    }

    // Handle different data types
    switch (config.type) {
      case 'array': {
        const arrayValue = Array.isArray(value) ? value : [];
        if (arrayValue.length === 0) {
          return config.label ? `No ${config.label}` : 'None';
        }
        return `${prefix}${arrayValue.join(', ')}${suffix}`;
      }

      case 'boolean':
        return config.label || config.key;

      case 'enum': {
        const stringValue = String(value);
        if (config.enumValues && config.enumValues[stringValue]) {
          return `${prefix}${config.enumValues[stringValue]}${suffix}`;
        }
        return `${prefix}${stringValue}${suffix}`;
      }

      case 'date':
        // Date formatting will be handled by the pipe in template
        return String(value);

      case 'string':
      case 'number':
      default:
        return `${prefix}${value}${suffix}`;
    }
  }

  getFilterLabel(config: FilterConfig): string {
    return config.label || config.key;
  }

  getDateRangeDisplay(config: FilterConfig): string {
    if (config.isRange && config.rangeKeys && config.type === 'date') {
      const startDate = this.filters[config.rangeKeys.min] as string;
      const endDate = this.filters[config.rangeKeys.max] as string;

      // Format dates using DatePipe-like formatting
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
      };

      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    return this.getDisplayValue(config);
  }

  shouldShowFilter(config: FilterConfig): boolean {
    // Don't show if filter is not active
    if (!this.isFilterActive(config)) {
      return false;
    }

    // For array filters, check if they have values
    if (config.type === 'array') {
      const value = this.filters[config.key];
      const arrayValue = Array.isArray(value) ? value : [];
      return arrayValue.length > 0;
    }

    return true;
  }
}
