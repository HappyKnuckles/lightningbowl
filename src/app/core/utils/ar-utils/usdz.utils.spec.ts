import { buildLaneUsda, buildUsdz, crc32, dataUriToBytes, UsdzEntry } from './usdz.utils';

const encoder = new TextEncoder();

function entry(name: string, contents: string): UsdzEntry {
  return { name, data: encoder.encode(contents) };
}

function readUint32(archive: Uint8Array, offset: number): number {
  return new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(offset, true);
}

function readUint16(archive: Uint8Array, offset: number): number {
  return new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint16(offset, true);
}

/** Walks the local headers, returning where each entry's payload starts. */
function dataOffsets(archive: Uint8Array, count: number): number[] {
  const offsets: number[] = [];
  let cursor = 0;

  for (let i = 0; i < count; i++) {
    expect(readUint32(archive, cursor)).toBe(0x04034b50);

    const size = readUint32(archive, cursor + 22);
    const nameLength = readUint16(archive, cursor + 26);
    const extraLength = readUint16(archive, cursor + 28);

    offsets.push(cursor + 30 + nameLength + extraLength);
    cursor += 30 + nameLength + extraLength + size;
  }

  return offsets;
}

describe('usdz utils', () => {
  describe('crc32', () => {
    it('matches the standard check vector', () => {
      // The canonical CRC-32 of "123456789".
      expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    });

    it('is zero for empty input', () => {
      expect(crc32(new Uint8Array(0))).toBe(0);
    });
  });

  describe('buildUsdz', () => {
    it('starts with a local file header', () => {
      const archive = buildUsdz([entry('scene.usda', '#usda 1.0')]);

      expect(readUint32(archive, 0)).toBe(0x04034b50);
    });

    it('stores entries uncompressed, as USDZ requires', () => {
      const archive = buildUsdz([entry('scene.usda', '#usda 1.0')]);

      // Compression method 0 == stored.
      expect(readUint16(archive, 8)).toBe(0);
    });

    it('aligns every entry payload to 64 bytes', () => {
      const archive = buildUsdz([
        entry('scene.usda', '#usda 1.0\n'.repeat(9)),
        entry('pattern.png', 'x'.repeat(517)),
        entry('a-much-longer-file-name.png', 'y'.repeat(23)),
      ]);

      for (const offset of dataOffsets(archive, 3)) {
        expect(offset % 64).toBe(0);
      }
    });

    it('keeps payloads byte-for-byte intact after padding', () => {
      const contents = 'lane pattern payload';
      const archive = buildUsdz([entry('scene.usda', '#usda 1.0'), entry('pattern.png', contents)]);

      const [, patternStart] = dataOffsets(archive, 2);
      const recovered = new TextDecoder().decode(archive.slice(patternStart, patternStart + contents.length));

      expect(recovered).toBe(contents);
    });

    it('records a matching CRC for each entry', () => {
      const data = encoder.encode('#usda 1.0');
      const archive = buildUsdz([{ name: 'scene.usda', data }]);

      expect(readUint32(archive, 14)).toBe(crc32(data));
    });

    it('ends with an end-of-central-directory record naming every entry', () => {
      const archive = buildUsdz([entry('scene.usda', 'a'), entry('pattern.png', 'b')]);
      const end = archive.length - 22;

      expect(readUint32(archive, end)).toBe(0x06054b50);
      expect(readUint16(archive, end + 8)).toBe(2);
      expect(readUint16(archive, end + 10)).toBe(2);
    });

    it('points the central directory at the real local header offsets', () => {
      const archive = buildUsdz([entry('scene.usda', 'a'), entry('pattern.png', 'b')]);
      const end = archive.length - 22;
      const centralOffset = readUint32(archive, end + 16);

      expect(readUint32(archive, centralOffset)).toBe(0x02014b50);
      // First entry's local header sits at the very start of the archive.
      expect(readUint32(archive, centralOffset + 42)).toBe(0);
    });
  });

  describe('buildLaneUsda', () => {
    const usda = buildLaneUsda('pattern.png', 'PBA Cheetah 35');

    it('declares real-world units so Quick Look places it at true size', () => {
      expect(usda).toContain('metersPerUnit = 1');
      expect(usda).toContain('upAxis = "Y"');
    });

    it('spans the real lane dimensions', () => {
      // 41.5in wide, 60ft to the pins.
      expect(usda).toContain('0.52705');
      expect(usda).toContain('18.2880');
    });

    it('references the supplied texture file', () => {
      expect(usda).toContain('asset inputs:file = @pattern.png@');
    });

    it('gives the mesh normals, without which renderers shade it black', () => {
      expect(usda).toContain('normal3f[] normals');
    });

    it('drives emissive as well as diffuse so it reads in a dim centre', () => {
      expect(usda).toContain('inputs:emissiveColor.connect');
      expect(usda).toContain('inputs:diffuseColor.connect');
    });

    it('supplies a texture fallback rather than defaulting to black', () => {
      expect(usda).toContain('inputs:fallback');
    });

    it('strips characters that would break the scene description', () => {
      expect(buildLaneUsda('pattern.png', 'Bad "quoted" (name)')).toContain('doc = "Bad quoted name');
    });
  });

  describe('dataUriToBytes', () => {
    it('decodes a base64 data uri', () => {
      expect(Array.from(dataUriToBytes('data:image/png;base64,AAEC'))).toEqual([0, 1, 2]);
    });

    it('rejects anything that is not base64', () => {
      expect(() => dataUriToBytes('data:image/png,raw')).toThrowError(/base64/);
    });
  });
});
