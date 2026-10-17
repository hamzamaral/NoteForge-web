import { describe, expect, it } from 'vitest';
import { fromDateInputValue, toDateInputValue } from './dates';

describe('dates', () => {
  it('round-trips date-only without UTC flip for noon local', () => {
    const iso = fromDateInputValue('2026-10-18');
    expect(iso).toBe('2026-10-18T12:00:00');
    expect(toDateInputValue(iso)).toBe('2026-10-18');
  });

  it('handles empty', () => {
    expect(fromDateInputValue('')).toBeNull();
    expect(toDateInputValue(null)).toBe('');
  });
});
