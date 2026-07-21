// usdz.utils.ts
//
// Builds a USDZ of the oil pattern lying flat, for AR Quick Look on iOS.
//
// A USDZ is a zip with two unusual constraints: entries must be STORED
// (uncompressed), and each entry's *data* must begin on a 64-byte boundary so
// the runtime can memory-map it in place. Both are handled here by padding the
// local header's extra field. Get either wrong and Quick Look silently refuses
// to open the file, so the layout is covered by tests.

import { LANE_LENGTH_FT, LANE_WIDTH_M, feetToMetres } from '../pattern-utils/board.utils';

const USDZ_ALIGNMENT = 64;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;

export interface UsdzEntry {
  name: string;
  data: Uint8Array;
}

let crcTable: Uint32Array | null = null;

function crcLookup(): Uint32Array {
  if (crcTable) {
    return crcTable;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }

  crcTable = table;
  return table;
}

export function crc32(data: Uint8Array): number {
  const table = crcLookup();
  let crc = 0xffffffff;
  for (const entry of data) {
    crc = table[(crc ^ entry) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** Packs entries into a USDZ archive. The first entry is the default layer. */
export function buildUsdz(entries: UsdzEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];

  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.data);

    // Pad the extra field so the data lands on a 64-byte boundary.
    const unpadded = offset + LOCAL_HEADER_SIZE + name.length;
    const extraLength = (USDZ_ALIGNMENT - (unpadded % USDZ_ALIGNMENT)) % USDZ_ALIGNMENT;

    const local = new Uint8Array(LOCAL_HEADER_SIZE + name.length + extraLength + entry.data.length);
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0, true); // flags
    localView.setUint16(8, 0, true); // stored, never deflated
    localView.setUint16(10, 0, true); // mod time
    localView.setUint16(12, 0, true); // mod date
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, extraLength, true);
    local.set(name, LOCAL_HEADER_SIZE);
    local.set(entry.data, LOCAL_HEADER_SIZE + name.length + extraLength);

    const central = new Uint8Array(CENTRAL_HEADER_SIZE + name.length);
    const centralView = new DataView(central.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true); // extra length
    centralView.setUint16(32, 0, true); // comment length
    centralView.setUint16(34, 0, true); // disk number
    centralView.setUint16(36, 0, true); // internal attributes
    centralView.setUint32(38, 0, true); // external attributes
    centralView.setUint32(42, offset, true);
    central.set(name, CENTRAL_HEADER_SIZE);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const total = offset + centralSize + end.length;
  const archive = new Uint8Array(total);
  let cursor = 0;

  for (const part of [...locals, ...centrals, end]) {
    archive.set(part, cursor);
    cursor += part.length;
  }

  return archive;
}

/**
 * The USD scene: one double-sided quad at true lane dimensions, textured with
 * the baked pattern and lying on the ground plane.
 *
 * metersPerUnit = 1 is what makes AR Quick Look place it at real-world size —
 * an 18.29 m strip, not a toy.
 */
export function buildLaneUsda(textureFile: string, patternTitle: string): string {
  const halfWidth = (LANE_WIDTH_M / 2).toFixed(5);
  const length = feetToMetres(LANE_LENGTH_FT).toFixed(4);
  const safeTitle = patternTitle.replace(/[^\w\s-]/g, '').trim() || 'Oil Pattern';

  return `#usda 1.0
(
    defaultPrim = "LanePattern"
    metersPerUnit = 1
    upAxis = "Y"
    doc = "${safeTitle} — Lightning Bowl"
)

def Xform "LanePattern"
{
    def Mesh "Lane"
    {
        uniform bool doubleSided = 1
        float3[] extent = [(-${halfWidth}, 0, 0), (${halfWidth}, 0, ${length})]
        int[] faceVertexCounts = [3, 3]
        int[] faceVertexIndices = [0, 1, 2, 0, 2, 3]
        point3f[] points = [(-${halfWidth}, 0, 0), (${halfWidth}, 0, 0), (${halfWidth}, 0, ${length}), (-${halfWidth}, 0, ${length})]
        normal3f[] normals = [(0, 1, 0), (0, 1, 0), (0, 1, 0), (0, 1, 0)] (
            interpolation = "vertex"
        )
        texCoord2f[] primvars:st = [(0, 0), (1, 0), (1, 1), (0, 1)] (
            interpolation = "vertex"
        )
        rel material:binding = </LanePattern/Materials/PatternMaterial>
        uniform token subdivisionScheme = "none"
    }

    def Scope "Materials"
    {
        def Material "PatternMaterial"
        {
            token outputs:surface.connect = </LanePattern/Materials/PatternMaterial/Surface.outputs:surface>

            def Shader "Surface"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </LanePattern/Materials/PatternMaterial/PatternTexture.outputs:rgb>
                // Also driven as emissive so the pattern reads at full strength
                // regardless of room lighting — bowling centres are dim, and
                // this is data to be read, not a surface to be lit.
                color3f inputs:emissiveColor.connect = </LanePattern/Materials/PatternMaterial/PatternTexture.outputs:rgb>
                float inputs:metallic = 0
                float inputs:roughness = 1
                token outputs:surface
            }

            def Shader "PatternTexture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${textureFile}@
                float2 inputs:st.connect = </LanePattern/Materials/PatternMaterial/UvReader.outputs:result>
                token inputs:wrapS = "clamp"
                token inputs:wrapT = "clamp"
                token inputs:sourceColorSpace = "sRGB"
                float4 inputs:fallback = (0.5, 0.5, 0.5, 1)
                float3 outputs:rgb
                float outputs:a
            }

            def Shader "UvReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 inputs:fallback = (0, 0)
                float2 outputs:result
            }
        }
    }
}
`;
}

/** Decodes the base64 payload of a data URI into bytes. */
export function dataUriToBytes(dataUri: string): Uint8Array {
  const marker = ';base64,';
  const index = dataUri.indexOf(marker);
  if (index === -1) {
    throw new Error('Expected a base64 data URI.');
  }

  const binary = atob(dataUri.slice(index + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
