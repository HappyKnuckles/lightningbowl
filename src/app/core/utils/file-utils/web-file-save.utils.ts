export type WebSaveResult = 'shared' | 'saved' | 'downloaded' | 'cancelled';

export interface WebSaveOptions {
  /** Open the share sheet (phones/tablets) instead of a save dialog (desktop). */
  preferShare: boolean;
}

/** File System Access API (Chrome/Edge desktop); not in TypeScript's DOM lib yet. */
interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
}

const DOWNLOAD_URL_LIFETIME_MS = 60_000;

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

/**
 * Saves a file from the browser or PWA so the user is actually asked where it goes.
 *
 * Chrome on Android saves `<a download>` files straight to Downloads without asking, so on mobile
 * the file goes to the share sheet ("Save to Files", Drive, mail, …) via the Web Share API. On
 * desktop Chrome/Edge a real "Save as" dialog opens. Where neither is available, or the browser
 * refuses (e.g. the tap that started the export is too long ago), the file is downloaded as before.
 */
export async function saveFileFromWeb(blob: Blob, fileName: string, options: WebSaveOptions): Promise<WebSaveResult> {
  if (options.preferShare) {
    const file = new File([blob], fileName, { type: blob.type });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      } catch (error) {
        if (isAbort(error)) return 'cancelled';
        // NotAllowedError etc.: fall back to a download rather than losing the export
      }
    }
  } else {
    const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
    if (typeof picker === 'function') {
      try {
        const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
        const handle = await picker({
          suggestedName: fileName,
          types: extension && blob.type ? [{ description: fileName, accept: { [blob.type]: [extension] } }] : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
      } catch (error) {
        if (isAbort(error)) return 'cancelled';
      }
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}

/** Plain browser download. A blob URL instead of a data URL: no size limit and no base64 copy of the file. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}
