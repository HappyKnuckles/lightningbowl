import { Injectable, inject } from '@angular/core';
import { ExcelService } from '@services/excel/excel.service';
import { PinpalService } from '../pinpal/pinpal.service';

export type ImportType = 'excel' | 'pinpal';

export type ImportResult =
  | {
      type: 'excel';
    }
  | {
      type: 'pinpal';
      importedGames: number;
    };

@Injectable({
  providedIn: 'root',
})
export class ImportDispatcherService {
  private excelService = inject(ExcelService);
  private pinpalService = inject(PinpalService);

  async importFromFile(file: File): Promise<ImportResult> {
    const importType = await this.detectImportType(file);

    if (importType === 'excel') {
      const gameData = await this.excelService.readExcelData(file);
      await this.excelService.transformData(gameData);
      return { type: 'excel' };
    }

    const importedGames = await this.pinpalService.importFromFile(file);
    return { type: 'pinpal', importedGames };
  }

  private async detectImportType(file: File): Promise<ImportType> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (extension === 'xlsx' || extension === 'xls') {
      return 'excel';
    }

    const header = new Uint8Array(await file.slice(0, 8192).arrayBuffer());

    if (this.isExcelHeader(header)) {
      return 'excel';
    }

    if (this.containsSqliteHeader(header)) {
      return 'pinpal';
    }

    if (extension === 'pinpal' || extension === 'db' || extension === 'sqlite' || extension === 'sqlite3') {
      return 'pinpal';
    }

    throw new Error('Unsupported import file type.');
  }

  private isExcelHeader(bytes: Uint8Array): boolean {
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return true;
    }

    if (
      bytes.length >= 8 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1
    ) {
      return true;
    }

    return false;
  }

  private containsSqliteHeader(bytes: Uint8Array): boolean {
    const header = new TextEncoder().encode('SQLite format 3');
    for (let i = 0; i <= bytes.length - header.length; i++) {
      let match = true;
      for (let j = 0; j < header.length; j++) {
        if (bytes[i + j] !== header[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }

    return false;
  }
}
