import { test, expect } from '@playwright/test';
import { shiftSearchDate, toSearchDate } from '../../src/support/dates';

test.describe('date helpers @unit', () => {
  test('formats the server epoch in UTC rather than the runner timezone', () => {
    expect(toSearchDate(Date.UTC(2026, 8, 3))).toBe('09-03-2026');
  });

  for (const [input, days, expected] of [
    ['12-31-2025', 1, '01-01-2026'],
    ['03-01-2024', -1, '02-29-2024'],
    ['01-31-2026', 1, '02-01-2026'],
    ['09-03-2026', 0, '09-03-2026'],
  ] as const) {
    test(`shifts ${input} by ${days} day(s)`, () => {
      expect(shiftSearchDate(input, days)).toBe(expected);
    });
  }

  for (const input of ['2026-09-03', '9-03-2026', '09/03/2026', '']) {
    test(`rejects malformed search date ${JSON.stringify(input)}`, () => {
      expect(() => shiftSearchDate(input, 1)).toThrow('is not an MM-DD-YYYY date');
    });
  }
});
