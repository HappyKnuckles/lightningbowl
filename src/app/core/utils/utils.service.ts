import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
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

  calculateStatDifference(currentValue: number, previousValue: number): string {
    if (previousValue === undefined) {
      return '0';
    }
    const difference = (currentValue - previousValue).toFixed(2);
    if (Number(difference) === 0) {
      return '0';
    }
    const percentageChange = previousValue === 0 ? '' : ((Number(difference) / previousValue) * 100).toFixed(2);
    const differenceWithSign = Number(difference) > 0 ? `+${difference}` : difference;
    return previousValue === 0 ? `${differenceWithSign}` : `${differenceWithSign} (${percentageChange}%)`;
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
