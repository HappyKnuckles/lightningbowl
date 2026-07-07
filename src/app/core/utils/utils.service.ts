import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  generateUniqueSeriesId(): string {
    return 'series-' + Math.random().toString(36).substring(2, 15);
  }

  transformDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  areDatesEqual(date1: string, date2: string): boolean {
    const formatDate = (date: string) => date.split('T')[0];
    return formatDate(date1) === formatDate(date2);
  }

  isSameDay(timestamp1: number, timestamp2: number): boolean {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  }

  isDayBefore(timestamp1: number, timestamp2: number): boolean {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);

    if (date1.getFullYear() < date2.getFullYear()) {
      return true;
    } else if (date1.getFullYear() === date2.getFullYear()) {
      if (date1.getMonth() < date2.getMonth()) {
        return true;
      } else if (date1.getMonth() === date2.getMonth()) {
        return date1.getDate() < date2.getDate();
      }
    }

    return false;
  }

  areArraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
  }

  isValidNumber0to10(value: number): boolean {
    return !isNaN(value) && value >= 0 && value <= 10;
  }

  isNumber(value: unknown): boolean {
    return !isNaN(parseFloat(value as string)) && isFinite(value as number);
  }

  parseIntValue(value: string): string | number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? '' : parsed;
  }

  calculateStatDelta(
    currentValue: number,
    previousValue: number | undefined,
  ): {
    delta: number;
    percent: number | null;
  } {
    if (previousValue == null) {
      return { delta: 0, percent: null };
    }
    const delta = Number((currentValue - previousValue).toFixed(2));
    const percent = previousValue === 0 ? null : Number(((delta / previousValue) * 100).toFixed(2));
    return { delta, percent };
  }

  formatStatDifference(currentValue: number, previousValue: number | undefined): string {
    const { delta, percent } = this.calculateStatDelta(currentValue, previousValue);
    if (delta === 0) {
      return '0';
    }
    const sign = delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
    return percent === null ? sign : `${sign} (${percent.toFixed(2)}%)`;
  }

  getArrowIcon(currentValue: number, previousValue?: number): string {
    if (previousValue === undefined || currentValue === undefined) {
      return '';
    }
    if (currentValue === previousValue) {
      return '';
    }
    return currentValue > previousValue ? 'arrow-up' : 'arrow-down';
  }

  getDiffColor(currentValue: number, previousValue?: number): string {
    if (previousValue === undefined || currentValue === undefined) {
      return '';
    }
    if (currentValue === previousValue) {
      return '';
    }
    return currentValue > previousValue ? 'success' : 'danger';
  }
}
