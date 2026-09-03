/**
 * ParaBank speaks two date dialects and neither is ISO:
 *
 *   - the REST API returns a transaction date as epoch milliseconds at *UTC
 *     midnight* of the day the server booked it (measured: `1788393600000` =
 *     `2026-09-03T00:00:00Z`);
 *   - `findtrans.htm` validates its inputs against `/^\d{2}-\d{2}-\d{4}$/` and
 *     passes them through to `.../transactions/onDate/MM-DD-YYYY`.
 *
 * Every date the suite types into the application is derived from a transaction
 * the application itself booked, never from `new Date()` on the test machine.
 * That is what keeps the date searches correct when the server's day and the
 * runner's day disagree across a midnight boundary.
 */

/** `1788393600000` -> `09-03-2026`, read in UTC because that is where the server put it. */
export function toSearchDate(epochMillis: number): string {
  const date = new Date(epochMillis);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}-${date.getUTCFullYear()}`;
}

/** Shifts a `MM-DD-YYYY` string by whole days, for building a range around a date. */
export function shiftSearchDate(searchDate: string, days: number): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(searchDate);
  if (!match) {
    throw new Error(`"${searchDate}" is not an MM-DD-YYYY date`);
  }
  const [, month, day, year] = match;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toSearchDate(shifted.getTime());
}
