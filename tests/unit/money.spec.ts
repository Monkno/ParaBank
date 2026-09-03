import { test, expect } from '@playwright/test';
import { dollarsToCents, formatCents, parseUsd } from '../../src/support/money';

/**
 * The parser is tested on its own because every balance assertion in the suite
 * runs both sides of a comparison through it. If it were only exercised
 * indirectly, a bug in it would cancel out — read "$515.00" wrong, read
 * "$415.00" wrong the same way, and the difference still comes out at $100.
 *
 * Every string below was copied from a real ParaBank response captured during
 * DOM recon, not invented.
 */
test.describe('parseUsd @unit', () => {
  for (const [input, expected] of [
    // Rendered by the app's own formatCurrency(), which uses toFixed(2) and no
    // thousands separator, and puts the minus sign before the dollar sign.
    ['$515.00', 51500],
    ['$0.00', 0],
    ['-$2300.00', -230000],
    ['$12.34', 1234],
    ['$1000.00', 100000],
    ['$130.25', 13025],
    ['$272.41', 27241],
    // Rendered by billpay.htm's second, different formatter: '$' + toFixed(2).
    ['$99.99', 9999],
    // Bare decimals, as the REST API returns them.
    ['515.00', 51500],
    ['-2300.00', -230000],
    ['0', 0],
    // Grouped form: not produced today, but a currency-format fix would.
    ['$1,234.56', 123456],
    ['-$1,234,567.89', -123456789],
    // Whitespace around a table cell's text.
    ['  $42.00  ', 4200],
  ] as const) {
    test(`parses ${JSON.stringify(input)} as ${expected} cents`, () => {
      expect(parseUsd(input)).toBe(expected);
    });
  }

  test('a one-digit fraction is tenths, not hundredths', () => {
    // "$1.5" must be 150 cents. Parsing the fraction with parseInt and no
    // padding would make it 15 and silently divide every such amount by ten.
    expect(parseUsd('$1.5')).toBe(150);
  });

  for (const input of ['', '   ', 'n/a', '$', 'No transactions found.', '$1.234']) {
    test(`refuses ${JSON.stringify(input)} instead of yielding NaN`, () => {
      expect(() => parseUsd(input)).toThrow(/not a US dollar amount|Cannot parse/);
    });
  }

  test('refuses null and undefined', () => {
    expect(() => parseUsd(null)).toThrow(/Cannot parse/);
    expect(() => parseUsd(undefined)).toThrow(/Cannot parse/);
  });
});

test.describe('dollarsToCents @unit', () => {
  for (const [input, expected] of [
    [515, 51500],
    [0, 0],
    [-2300, -230000],
    [12.34, 1234],
    [130.25, 13025],
    // The float that motivates working in cents at all:
    // 515 - 100 - 30.25 - 12.34 evaluates to 372.40999999999997.
    [372.40999999999997, 37241],
  ] as const) {
    test(`converts ${input} dollars to ${expected} cents`, () => {
      expect(dollarsToCents(input)).toBe(expected);
    });
  }

  test('the two parsers agree on the same amount by different routes', () => {
    // The UI string and the API number for one balance, converted independently.
    expect(parseUsd('$272.41')).toBe(dollarsToCents(272.41));
  });
});

test.describe('formatCents @unit', () => {
  for (const [input, expected] of [
    [51500, '$515.00'],
    [0, '$0.00'],
    [-230000, '-$2300.00'],
    [5, '$0.05'],
  ] as const) {
    test(`renders ${input} as ${expected}`, () => {
      expect(formatCents(input)).toBe(expected);
    });
  }
});
