/** An RGBA pixel buffer, 4 bytes per pixel, rows top to bottom. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

export type Rgb = readonly [number, number, number];

/** A raster filled with one opaque color, or transparent without one. */
export function createRaster(width: number, height: number, fill?: Rgb): Raster {
  const data = new Uint8Array(width * height * 4);
  if (fill)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = 255;
    }
  return { width, height, data };
}

/** A rectangle of a raster, such as one sprite in an atlas. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Copies the opaque pixels of `region` of `src` to (`dx`, `dy`) in `dest`, clipped
 * to `dest`. Art has hard alpha (ART_DIRECTION.md §6), so a pixel either replaces
 * what is below it or is skipped: no blending.
 */
export function blit(dest: Raster, src: Raster, region: Region, dx: number, dy: number) {
  for (let row = 0; row < region.height; row++) {
    const y = dy + row;
    if (y < 0 || y >= dest.height) continue;
    for (let col = 0; col < region.width; col++) {
      const x = dx + col;
      if (x < 0 || x >= dest.width) continue;
      const s = ((region.y + row) * src.width + region.x + col) * 4;
      if (src.data[s + 3] === 0) continue;
      dest.data.set(src.data.subarray(s, s + 4), (y * dest.width + x) * 4);
    }
  }
}

/** Every pixel becomes a `factor` × `factor` block: pixel art stays sharp. */
export function scaleNearest(src: Raster, factor: number): Raster {
  if (factor === 1) return src;
  const out = createRaster(src.width * factor, src.height * factor);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < out.width; x++) {
      const s = (sy * src.width + Math.floor(x / factor)) * 4;
      out.data.set(src.data.subarray(s, s + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

export interface FitOptions {
  /** Smallest whole scale factor; a source too big at this factor is cropped. */
  minFactor?: number;
  /** Largest whole scale factor, so a tiny source does not become a few huge blocks. */
  maxFactor?: number;
  /** Fit into the top `fitHeight` rows only, and center there, when the source fits. */
  fitHeight?: number;
}

/**
 * Fits `src` into a `width` × `height` frame on a solid background: scaled by the
 * largest whole factor that fits (clamped by the options), then centered. A
 * source bigger than the frame at that factor is cropped around its center.
 */
export function fitFrame(
  src: Raster,
  width: number,
  height: number,
  background: Rgb,
  { minFactor = 1, maxFactor = Infinity, fitHeight = height }: FitOptions = {},
): Raster {
  const fit = Math.floor(Math.min(width / src.width, fitHeight / src.height));
  const factor = Math.max(1, minFactor, Math.min(maxFactor, fit));
  const scaledWidth = src.width * factor;
  const scaledHeight = src.height * factor;
  const areaHeight = scaledHeight <= fitHeight ? fitHeight : height;
  const dx = Math.floor((width - scaledWidth) / 2);
  const dy = Math.floor((areaHeight - scaledHeight) / 2);
  // Scaled straight into the frame: a big city is mostly cropped away.
  const out = createRaster(width, height, background);
  for (let y = Math.max(0, dy); y < Math.min(height, dy + scaledHeight); y++) {
    const sy = Math.floor((y - dy) / factor);
    for (let x = Math.max(0, dx); x < Math.min(width, dx + scaledWidth); x++) {
      const s = (sy * src.width + Math.floor((x - dx) / factor)) * 4;
      if (src.data[s + 3] === 0) continue;
      out.data.set(src.data.subarray(s, s + 4), (y * width + x) * 4);
    }
  }
  return out;
}

/**
 * A `width` × `height` panel from a nine-slice source, like CSS `border-image`
 * with `repeat`: corners kept, edges and center tiled. `inset` is the border
 * width in source pixels on every side.
 */
export function ninePatch(src: Raster, inset: number, width: number, height: number): Raster {
  const out = createRaster(width, height);
  const middleW = src.width - 2 * inset;
  const middleH = src.height - 2 * inset;
  // Source coordinate for each output coordinate along one axis.
  const axis = (at: number, size: number, srcSize: number, middle: number) =>
    at < inset ? at : at >= size - inset ? srcSize - (size - at) : inset + ((at - inset) % middle);
  for (let y = 0; y < height; y++) {
    const sy = axis(y, height, src.height, middleH);
    for (let x = 0; x < width; x++) {
      const s = (sy * src.width + axis(x, width, src.width, middleW)) * 4;
      out.data.set(src.data.subarray(s, s + 4), (y * width + x) * 4);
    }
  }
  return out;
}
