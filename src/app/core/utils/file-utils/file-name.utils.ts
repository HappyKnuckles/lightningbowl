const pad = (value: number): string => value.toString().padStart(2, '0');

/**
 * `<base>_YYYY-MM-DD_HH-mm.<extension>` in local time. Sorts chronologically and only clashes for two
 * exports within the same minute; whatever saves the file (save dialog, share target, download) handles that case.
 */
export function timestampedFileName(base: string, extension: string, date = new Date()): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `${base}_${day}_${time}.${extension}`;
}
