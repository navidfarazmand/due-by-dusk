import { describe, expect, it } from 'vitest';
import { cropBounds, cropDepth, cropSizeBoost, FIELD_HEIGHT } from '../src/domain/fieldLayout';
describe('phone-sized vegetables and safe harvest area', () => {
  for (const [width,height] of [[914,280],[844,260],[800,240],[667,240],[1440,750]]) {
    it(`keeps carrots large and reachable in ${width} × ${height} field`, () => {
      const scale=height/FIELD_HEIGHT, bounds=cropBounds(width,height,19,42,48);
      const size=cropDepth(bounds.bottom,height);
      expect(38*size*scale).toBeGreaterThanOrEqual(32);
      expect(bounds.left*scale).toBeGreaterThanOrEqual(38);
      expect(bounds.top).toBeLessThanOrEqual(bounds.bottom);
      const fingerY=(bounds.bottom-19*size*.55)*scale+48;
      expect(fingerY).toBeLessThanOrEqual(height-15);
      expect(bounds.bottom).toBeLessThan(FIELD_HEIGHT);
    });
  }
  it('responds to the adjustable finger offset without changing damage or rewards', () => {
    expect(cropBounds(844,260,19,42,80).bottom).toBeLessThan(cropBounds(844,260,19,42,0).bottom);
    expect(cropSizeBoost(260)).toBeGreaterThan(2);
    expect(cropSizeBoost(800)).toBe(1);
  });
});
