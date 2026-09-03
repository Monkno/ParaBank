import { test, expect } from '../../src/fixtures/test';
import { shiftSearchDate, toSearchDate } from '../../src/support/dates';
import { dollarsToCents } from '../../src/support/money';

/**
 * TC23 — the four search criteria, all against a transaction this test created
 * on an account this test owns.
 *
 * The transaction under test is the opening deposit of a freshly opened account:
 * a brand-new account has exactly one transaction and no history to disambiguate
 * against, which is what lets the *date* and *date-range* searches assert a
 * singleton result rather than "contains". The account is created with *Open New
 * Account* rather than a bill payment because bill-pay processing is currently
 * intermittent on the shared demo (defect D18) while account opening is not — and
 * the case is about search, not about how the row came to exist. Nothing here can
 * match another customer's data: the account was created by this test.
 */
test.describe('Find transactions @accounts', () => {
  test('TC23 — every search criterion finds the transaction the test created', async ({
    signedIn,
    openAccountPage,
    findTransactionsPage,
    settle,
  }) => {
    await openAccountPage.open();
    const newAccountId = await openAccountPage.openNewAccount('SAVINGS', signedIn.primaryAccountId);

    // The opening deposit is booked asynchronously; wait for the row before
    // searching for it, or every criterion races an empty statement.
    const transactions = await settle.atLeastTransactions(newAccountId, 1);
    expect(transactions, 'a new account has exactly its opening deposit').toHaveLength(1);
    const created = transactions[0];

    // The date is taken from the transaction the server booked, never from the
    // runner's clock: the two disagree either side of midnight, and that
    // disagreement would make this test fail once a day for no good reason.
    const bookedOn = toSearchDate(created.date);
    const amountCents = dollarsToCents(created.amount);
    const expectedRow = {
      date: bookedOn,
      description: 'Funds Transfer Received',
      debit: null,
      credit: amountCents,
    };

    await findTransactionsPage.open();
    expect(
      await findTransactionsPage.findById(newAccountId, created.id),
      `find by transaction id ${created.id}`,
    ).toEqual([expectedRow]);

    await findTransactionsPage.open();
    expect(
      await findTransactionsPage.findByDate(newAccountId, bookedOn),
      `find by date ${bookedOn}`,
    ).toEqual([expectedRow]);

    await findTransactionsPage.open();
    expect(
      await findTransactionsPage.findByDateRange(
        newAccountId,
        shiftSearchDate(bookedOn, -1),
        shiftSearchDate(bookedOn, 1),
      ),
      `find by the date range around ${bookedOn}`,
    ).toEqual([expectedRow]);

    await findTransactionsPage.open();
    expect(
      await findTransactionsPage.findByAmount(newAccountId, created.amount.toFixed(2)),
      `find by amount ${created.amount.toFixed(2)}`,
    ).toEqual([expectedRow]);
  });

  /**
   * The negative half the case does not mention: a criterion that matches
   * nothing must return nothing, and a malformed criterion must not search at
   * all. Without these, "find by amount" would pass just as well if the page
   * ignored the amount and returned every row.
   */
    test('TC23 — a malformed date is rejected client-side and no search runs', async ({
    signedIn,
    findTransactionsPage,
    page,
  }) => {
    await findTransactionsPage.open();
    await findTransactionsPage.accountSelect.selectOption(String(signedIn.primaryAccountId));
    await page.locator('#transactionDate').fill('2026-09-03'); // ISO, not MM-DD-YYYY
    await page.locator('#findByDate').click();

    await expect(findTransactionsPage.error('transactionDate')).toHaveText('Invalid date format');
    // The form is still on screen: the page short-circuited before searching.
    await expect(page.locator('#formContainer')).toBeVisible();
    await expect(page.locator('#resultContainer')).toBeHidden();
  });
});
