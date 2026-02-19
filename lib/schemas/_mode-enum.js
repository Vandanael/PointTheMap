import { z } from 'zod';
import { MODE_VALUES } from '../config/game-modes.js';

/**
 * Convert a non-empty string array into a z.enum-compatible tuple.
 * Throws early so schema initialization cannot silently degrade.
 *
 * @param {readonly string[]} values
 * @returns {[string, ...string[]]}
 */
function toNonEmptyTuple(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('MODE_VALUES must be a non-empty string array');
  }
  if (values.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error('MODE_VALUES must contain only non-empty strings');
  }
  const [head, ...tail] = values;
  return [head, ...tail];
}

export const modeValuesTuple = toNonEmptyTuple(MODE_VALUES);
export const ModeEnumSchema = z.enum(modeValuesTuple);
