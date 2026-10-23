// Phone sizing uses CSS pixels, independent of device pixel density and game balance.
export const FIELD_HEIGHT = 640;
export const FIELD_START = 180;
export function cropSizeBoost(cssHeight: number): number {
  const scale = Math.max(1, cssHeight) / FIELD_HEIGHT;
  return Math.min(3, Math.max(1, 38 / (38 * scale)));
}
export function cropDepth(y: number, cssHeight: number): number {
  const progress = Math.max(0, Math.min(1, (y - FIELD_START) / (FIELD_HEIGHT - FIELD_START)));
  return (.95 + .15 * progress) * cropSizeBoost(cssHeight);
}
export function cropBounds(cssWidth: number, cssHeight: number, radius: number, top: number, touchOffset: number) {
  const scale = Math.max(1, cssHeight) / FIELD_HEIGHT;
  const worldWidth = cssWidth / scale;
  const size = cropDepth(FIELD_HEIGHT, cssHeight);
  const side = Math.max(40 / scale, radius * size + 12 / scale);
  // Keep the whole vegetable and its offset finger contact inside the field.
  const minY = FIELD_START + Math.max(top * size * .9, 32 / scale);
  const bottom = Math.max(28 / scale, (Math.max(0, touchOffset) + 20) / scale - radius * size * .45);
  const maxY = FIELD_HEIGHT - bottom;
  return {
    left: Math.min(side, worldWidth * .4), right: Math.max(worldWidth - side, worldWidth * .6),
    top: Math.min(minY, maxY), bottom: maxY,
  };
}
