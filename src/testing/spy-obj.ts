import { vi } from 'vitest';
import type { MockedObject } from 'vitest';

/** Vitest stand-in for Jasmine's `SpyObj<T>`. */
export type SpyObj<T> = MockedObject<T>;

/**
 * Builds a partial mock of `T` where every named member is a `vi.fn()`, plus any
 * plain property values passed in `properties`.
 *
 * Replaces `jasmine.createSpyObj('Name', ['a', 'b'], { c: 1 })` — Vitest spies
 * carry no name, so only the member list and properties are needed.
 */
export function createSpyObj<T>(memberNames: readonly string[], properties: Record<string, unknown> = {}): SpyObj<T> {
  const spyObj: Record<string, unknown> = { ...properties };
  for (const name of memberNames) {
    spyObj[name] = vi.fn();
  }
  return spyObj as SpyObj<T>;
}
