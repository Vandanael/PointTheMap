import { describe, it, expect } from 'vitest';
import { MODE_VALUES } from '../config/game-modes.js';
import { modeValuesTuple, ModeEnumSchema } from './_mode-enum.js';

describe('ModeEnumSchema', () => {
  it('uses all canonical mode values', () => {
    expect(modeValuesTuple).toEqual(MODE_VALUES);
    expect(new Set(MODE_VALUES).size).toBe(MODE_VALUES.length);
    expect(MODE_VALUES.length).toBe(8);
  });

  it('accepts valid modes and rejects unknown values', () => {
    for (const mode of MODE_VALUES) {
      expect(ModeEnumSchema.safeParse(mode).success).toBe(true);
    }

    expect(ModeEnumSchema.safeParse('not-a-mode').success).toBe(false);
  });
});
