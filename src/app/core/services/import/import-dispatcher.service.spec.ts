import { TestBed } from '@angular/core/testing';
import { ExcelService } from 'src/app/core/services/excel/excel.service';
import { PinpalService } from 'src/app/core/services/pinpal/pinpal.service';
import { createSpyObj, SpyObj } from 'src/testing/spy-obj';
import { ImportDispatcherService } from './import-dispatcher.service';

const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];
const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function file(name: string, bytes: number[] = []): File {
  return new File([new Uint8Array(bytes)], name);
}

/** Bytes of an SQLite database, whose magic string starts at `offset`. */
function sqliteBytes(offset = 0): number[] {
  const padding = Array.from({ length: offset }, () => 0);
  return [...padding, ...Array.from(new TextEncoder().encode('SQLite format 3\0'))];
}

describe('ImportDispatcherService', () => {
  let service: ImportDispatcherService;
  let excelService: SpyObj<ExcelService>;
  let pinpalService: SpyObj<PinpalService>;

  beforeEach(() => {
    excelService = createSpyObj<ExcelService>(['readExcelData', 'transformData']);
    excelService.readExcelData.mockResolvedValue([]);
    excelService.transformData.mockResolvedValue(undefined);

    pinpalService = createSpyObj<PinpalService>(['importFromFile']);
    pinpalService.importFromFile.mockResolvedValue(0);

    TestBed.configureTestingModule({
      providers: [
        { provide: ExcelService, useValue: excelService },
        { provide: PinpalService, useValue: pinpalService },
      ],
    });
    service = TestBed.inject(ImportDispatcherService);
  });

  describe('excel imports', () => {
    it('reads and transforms a file recognised by its extension', async () => {
      const workbook = file('history.xlsx');
      const parsed = [{ any: 'row' }];
      excelService.readExcelData.mockResolvedValue(parsed);

      const result = await service.importFromFile(workbook);

      expect(result).toEqual({ type: 'excel' });
      expect(excelService.readExcelData).toHaveBeenCalledWith(workbook);
      expect(excelService.transformData).toHaveBeenCalledWith(parsed);
      expect(pinpalService.importFromFile).not.toHaveBeenCalled();
    });

    it('accepts the legacy xls extension', async () => {
      await expect(service.importFromFile(file('history.xls'))).resolves.toEqual({ type: 'excel' });
    });

    it('detects a zipped workbook by its header', async () => {
      await expect(service.importFromFile(file('export.bin', ZIP_HEADER))).resolves.toEqual({ type: 'excel' });
    });

    it('detects an old binary workbook by its header', async () => {
      await expect(service.importFromFile(file('export.bin', OLE_HEADER))).resolves.toEqual({ type: 'excel' });
    });
  });

  describe('pinpal imports', () => {
    it('reports how many games were imported from a SQLite database', async () => {
      pinpalService.importFromFile.mockResolvedValue(42);
      const backup = file('backup.bin', sqliteBytes());

      const result = await service.importFromFile(backup);

      expect(result).toEqual({ type: 'pinpal', importedGames: 42 });
      expect(pinpalService.importFromFile).toHaveBeenCalledWith(backup);
      expect(excelService.readExcelData).not.toHaveBeenCalled();
    });

    it('finds the SQLite header further into the file', async () => {
      await expect(service.importFromFile(file('backup.bin', sqliteBytes(100)))).resolves.toMatchObject({ type: 'pinpal' });
    });

    it('falls back to the extension when the header is unrecognised', async () => {
      for (const name of ['backup.pinpal', 'backup.db', 'backup.sqlite', 'backup.sqlite3']) {
        await expect(service.importFromFile(file(name, [1, 2, 3, 4]))).resolves.toMatchObject({ type: 'pinpal' });
      }
    });
  });

  it('rejects a file it cannot recognise', async () => {
    await expect(service.importFromFile(file('notes.txt', [1, 2, 3, 4]))).rejects.toThrow('Unsupported import file type.');
  });
});
