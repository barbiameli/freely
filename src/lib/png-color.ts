import { inflateSync } from "zlib";

/**
 * Decodes a PNG's raw pixel data (using Node's built-in zlib, no image
 * library needed — same "hand-roll it" approach as readPngHeader in
 * actions/memory.ts) and returns a representative hex color from its
 * non-transparent pixels. Used to give a brand-new user a sane default
 * primary color the moment they upload a logo, instead of leaving it at
 * Freely's own coral until they think to set one themselves in Branding.
 *
 * Deliberately narrow: only handles 8-bit, non-interlaced PNGs with an alpha
 * channel (color type 6 = truecolor+alpha, or 4 = greyscale+alpha) — which
 * is exactly what uploadBrandLogoAction already requires logos to be. Any
 * other case (16-bit, interlaced, corrupt) just returns null and the app
 * falls back to the manual color picker, same as before this existed.
 */
export function extractDominantColor(buffer: Buffer): string | null {
  try {
    const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer.readUInt8(24);
    const colorType = buffer.readUInt8(25);
    const interlace = buffer.readUInt8(28);
    if (bitDepth !== 8 || interlace !== 0) return null;
    const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : null;
    if (!channels) return null;

    // Walk the chunk list from just after the IHDR chunk, collecting every
    // IDAT chunk's data (a PNG can split image data across several).
    const idatParts: Buffer[] = [];
    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const dataStart = offset + 8;
      if (type === "IDAT") idatParts.push(buffer.subarray(dataStart, dataStart + length));
      if (type === "IEND") break;
      offset = dataStart + length + 4; // +4 skips the trailing CRC
    }
    if (idatParts.length === 0) return null;

    const raw = inflateSync(Buffer.concat(idatParts));
    const stride = width * channels;
    const prevRow = Buffer.alloc(stride);
    const row = Buffer.alloc(stride);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let weight = 0;

    let pos = 0;
    for (let y = 0; y < height; y++) {
      if (pos >= raw.length) break;
      const filterType = raw[pos];
      pos += 1;
      raw.copy(row, 0, pos, pos + stride);
      pos += stride;
      unfilterRow(row, prevRow, filterType, channels);

      // Sampling every pixel on every row is unnecessary for an average —
      // a few thousand samples across the image is plenty.
      const rowStep = Math.max(1, Math.floor(width / 200));
      for (let x = 0; x < width; x += rowStep) {
        const i = x * channels;
        const alpha = channels === 4 ? row[i + 3] : row[i + 1];
        if (alpha < 40) continue; // skip near-transparent pixels
        const r = row[i];
        const g = channels === 4 ? row[i + 1] : row[i];
        const b = channels === 4 ? row[i + 2] : row[i];
        const w = alpha / 255;
        rSum += r * w;
        gSum += g * w;
        bSum += b * w;
        weight += w;
      }
      prevRow.set(row);
    }

    if (weight < 1) return null; // logo was essentially fully transparent
    const r = Math.round(rSum / weight);
    const g = Math.round(gSum / weight);
    const b = Math.round(bSum / weight);
    return `#${[r, g, b].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return null; // never let a decoding hiccup break the actual upload
  }
}

function unfilterRow(row: Buffer, prevRow: Buffer, filterType: number, channels: number): void {
  for (let i = 0; i < row.length; i++) {
    const a = i >= channels ? row[i - channels] : 0; // left
    const b = prevRow[i]; // above
    const c = i >= channels ? prevRow[i - channels] : 0; // above-left
    let value = row[i];
    switch (filterType) {
      case 1: // Sub
        value = (value + a) & 0xff;
        break;
      case 2: // Up
        value = (value + b) & 0xff;
        break;
      case 3: // Average
        value = (value + Math.floor((a + b) / 2)) & 0xff;
        break;
      case 4: // Paeth
        value = (value + paethPredictor(a, b, c)) & 0xff;
        break;
      default:
        break; // 0 = None
    }
    row[i] = value;
  }
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
