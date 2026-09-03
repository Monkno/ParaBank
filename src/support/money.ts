/**
 * ParaBank formats every amount with this function, copied verbatim from
 * `overview.htm`, `activity.htm`, `transfer.htm` and `findtrans.htm`:
 *
 *     amount = parseFloat(amount);
 *     var isNegative = amount < 0;
 *     amount = Math.abs(amount);
 *     var formattedAmount = amount.toFixed(2);
 *     return (isNegative ? '-$' : '$') + formattedAmount;
 *
 * So the strings the UI actually produces are `$515.00`, `$0.00`, `-$2300.00` —
 * the minus sign goes *before* the dollar sign, and there are no thousands
 * separators. `billpay.htm` uses a second, different formatter (`'$' +
 * amount.toFixed(2)`) which cannot render a negative at all. The parser below
 * accepts both, plus grouped forms, because the REST API returns bare decimals
 * like `-2300.00` and a future fix might add separators.
 *
 * Everything downstream works in integer cents. Balances are compared with `===`
 * on cents, never with a float tolerance: a bank that is off by a hundredth of a
 * cent is wrong, and `515.00 - 100 - 30.25 - 12.34` is `372.40999999999997` in
 * IEEE 754.
 */

/** Integer cents. A distinct name so a raw float never reaches an assertion by accident. */
export type Cents = number;

/**
 * `"$1,234.56"` -> `123456`. `"-$2300.00"` -> `-230000`. `"-2300.00"` -> `-230000`.
 *
 * Throws rather than returning NaN: an unparseable amount is a failed
 * assertion with a readable message, not a silent zero.
 */
export function parseUsd(raw: string | null | undefined): Cents {
  if (raw === null || raw === undefined) {
    throw new Error(`Cannot parse an amount out of ${JSON.stringify(raw)}`);
  }

  const text = raw.trim();
  // The sign may sit either side of the currency symbol; ParaBank puts it
  // before, a bare API decimal puts it in the only place available.
  const match = /^(-)?\$?(-)?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`"${raw}" is not a US dollar amount`);
  }

  const negative = Boolean(match[1] ?? match[2]);
  const whole = Number.parseInt(match[3].replace(/,/g, ''), 10);
  // "1.5" is 150 cents, not 15. Pad before parsing rather than after.
  const fraction = Number.parseInt((match[4] ?? '').padEnd(2, '0') || '0', 10);

  const cents = whole * 100 + fraction;
  return negative ? -cents : cents;
}

/**
 * `515` (a JSON number of dollars) -> `51500` cents.
 *
 * Deliberately not implemented as `Math.round(dollars * 100)` alone: this is the
 * conversion applied to the REST API's side of every balance comparison, and if
 * it shared a code path with `parseUsd` a bug in either would cancel out when
 * the two are compared. It is a separate three-line function tested on its own
 * inputs.
 */
export function dollarsToCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) {
    throw new Error(`Cannot convert ${dollars} to cents`);
  }
  return Math.round(dollars * 100);
}

/** For assertion messages: `-230000` -> `-$2300.00`, matching what the UI shows. */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
