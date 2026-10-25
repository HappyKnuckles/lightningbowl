import { vi } from 'vitest';

import { saveFileFromWeb } from './web-file-save.utils';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('saveFileFromWeb', () => {
  const blob = new Blob(['data'], { type: XLSX });
  let clicks: { href: string; download: string }[];
  const originals = {
    share: Object.getOwnPropertyDescriptor(navigator, 'share'),
    canShare: Object.getOwnPropertyDescriptor(navigator, 'canShare'),
    picker: Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker'),
  };

  const setNavigator = (name: 'share' | 'canShare', value: unknown) => Object.defineProperty(navigator, name, { value, configurable: true });
  const setPicker = (value: unknown) => Object.defineProperty(window, 'showSaveFilePicker', { value, configurable: true, writable: true });
  const domError = (name: string) => new DOMException('test', name);

  beforeEach(() => {
    clicks = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [name, target] of [
      ['share', navigator],
      ['canShare', navigator],
    ] as const) {
      const original = originals[name];
      if (original) Object.defineProperty(target, name, original);
      else delete (target as unknown as Record<string, unknown>)[name];
    }
    if (originals.picker) Object.defineProperty(window, 'showSaveFilePicker', originals.picker);
    else delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
  });

  describe('on mobile', () => {
    it('opens the share sheet with the file', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNavigator('share', share);
      setNavigator('canShare', vi.fn().mockReturnValue(true));

      const result = await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: true });

      expect(result).toBe('shared');
      const file = (share.mock.calls[0][0] as ShareData).files![0];
      expect(file.name).toBe('game_data.xlsx');
      expect(file.type).toBe(XLSX);
      expect(clicks).toEqual([]);
    });

    it('reports a dismissed share sheet as cancelled without downloading', async () => {
      setNavigator('share', vi.fn().mockRejectedValue(domError('AbortError')));
      setNavigator('canShare', vi.fn().mockReturnValue(true));

      expect(await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: true })).toBe('cancelled');
      expect(clicks).toEqual([]);
    });

    it('downloads instead when the browser refuses to share (e.g. the tap was too long ago)', async () => {
      setNavigator('share', vi.fn().mockRejectedValue(domError('NotAllowedError')));
      setNavigator('canShare', vi.fn().mockReturnValue(true));

      expect(await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: true })).toBe('downloaded');
      expect(clicks).toEqual([{ href: 'blob:export', download: 'game_data.xlsx' }]);
    });

    it('downloads when files cannot be shared', async () => {
      setNavigator('share', vi.fn());
      setNavigator('canShare', vi.fn().mockReturnValue(false));

      expect(await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: true })).toBe('downloaded');
      expect(navigator.share).not.toHaveBeenCalled();
      expect(clicks.length).toBe(1);
    });
  });

  describe('on desktop', () => {
    it('saves through the "Save as" dialog', async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      const close = vi.fn().mockResolvedValue(undefined);
      const picker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue({ write, close }) });
      setPicker(picker);

      const result = await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: false });

      expect(result).toBe('saved');
      expect(picker).toHaveBeenCalledWith({
        suggestedName: 'game_data.xlsx',
        types: [{ description: 'game_data.xlsx', accept: { [XLSX]: ['.xlsx'] } }],
      });
      expect(write).toHaveBeenCalledWith(blob);
      expect(close).toHaveBeenCalled();
      expect(clicks).toEqual([]);
    });

    it('reports a cancelled dialog as cancelled', async () => {
      setPicker(vi.fn().mockRejectedValue(domError('AbortError')));

      expect(await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: false })).toBe('cancelled');
      expect(clicks).toEqual([]);
    });

    it('downloads in browsers without the dialog', async () => {
      delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];

      expect(await saveFileFromWeb(blob, 'game_data.xlsx', { preferShare: false })).toBe('downloaded');
      expect(clicks).toEqual([{ href: 'blob:export', download: 'game_data.xlsx' }]);
    });
  });
});
