import { deflateSync, inflateSync } from "node:zlib";
import type { Raster } from "@/core/raster";

// Only the PNGs this project writes and reads: 8-bit RGBA or RGB, not interlaced.
// Enough for the packed atlas in, social previews out, with no dependency.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGBA raster as a PNG file. Rows are stored unfiltered. */
export function encodePng(raster: Raster): Buffer {
  const { width, height, data } = raster;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++)
    rows.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** A PNG file as an RGBA raster. Throws on a format this codec does not read. */
export function decodePng(file: Uint8Array): Raster {
  const bytes = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("png: not a PNG file");
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, color, , , interlace] = data.subarray(8);
      if (depth !== 8 || (color !== 6 && color !== 2) || interlace !== 0)
        throw new Error(`png: unsupported format (depth ${depth}, color ${color})`);
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  if (channels === 0) throw new Error("png: missing IHDR");

  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[row + i - channels]! : 0;
      const up = y > 0 ? pixels[row - stride + i]! : 0;
      const upLeft = y > 0 && i >= channels ? pixels[row - stride + i - channels]! : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? (left + up) >> 1
                : filter === 4
                  ? paeth(left, up, upLeft)
                  : NaN;
      if (Number.isNaN(predictor)) throw new Error(`png: bad filter ${filter}`);
      pixels[row + i] = (line[i]! + predictor) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: pixels };
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data.set(pixels.subarray(p * 3, p * 3 + 3), p * 4);
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}
