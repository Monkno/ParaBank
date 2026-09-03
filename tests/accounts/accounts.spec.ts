import { test, expect } from '../../src/fixtures/test';
import { dollarsToCents, formatCents } from '../../src/support/money';

test.describe('Accounts @accounts', () => {
  /**
   * A single-account customer would make this case pass on a table with one row
   * and a Total that is a copy of it. A second account is opened first so the
   * Total is a real sum of two different numbers.
   */
  test('TC15 — Accounts Overview lists every account, its available amount and a correct total', async ({
    signedIn,
    openAccountPage,
    overviewPage,
    bankApi,
  }) => {
    await openAccountPage.open();
    await openAccountPage.openNewAccount('SAVINGS', signedIn.primaryAccountId);

    await overviewPage.open();
    const rows = await overviewPage.readAccountRows();
    const accounts = await bankApi.listAccounts(signedIn.customerId);

    expect(rows.length, 'the customer now holds two accounts').toBe(2);
    expect(rows.length, 'every account the backend holds is listed').toBe(accounts.length);

    const byId = new Map(accounts.map((account) => [account.id, account]));
    for (const row of rows) {
      const account = byId.get(row.accountId);
      expect(account, `row for account ${row.accountId} has no backend counterpart`).toBeDefined();
      expect(row.balance, `balance of account ${row.accountId}`).toBe(dollarsToCents(account!.balance));
      // The page's own rule: a negative balance shows an available amount of $0.
      expect(row.available, `available amount of account ${row.accountId}`).toBe(Math.max(row.balance, 0));
    }

    // The arithmetic the page performed, checked against the numbers it printed.
    const expectedTotal = rows.reduce((sum, row) => sum + row.balance, 0);
    const shownTotal = await overviewPage.readTotal();
    expect(shownTotal, `Total row: expected ${formatCents(expectedTotal)}`).toBe(expectedTotal);
  });

  /**
   * TC16, once per account type. The two variants differ in exactly one thing —
   * the option chosen in `#type` — so they are one test parameterised by it
   * rather than two near-copies. Both need the same fixture, so nothing pays for
   * a fixture it does not use.
   *
   * The opening deposit is never written down as $100. It is a server-side
   * parameter (`minimumBalance`) that anyone can change through admin.htm, so
   * the test derives it from what actually left the source account and then
   * insists the same amount arrived, and that nothing else moved.
   */
  for (const accountType of ['CHECKING', 'SAVINGS'] as const) {
    test(`TC16 — opening a ${accountType} account moves the deposit and nothing else`, async ({
      signedIn,
      openAccountPage,
      overviewPage,
      bankApi,
      settle,
    }) => {
      const sourceBeforeDollars = await bankApi.balanceOf(signedIn.primaryAccountId);
      const sourceBefore = dollarsToCents(sourceBeforeDollars);

      await openAccountPage.open();
      // The source list is the customer's own accounts and no one else's.
      expect(await openAccountPage.availableSourceAccounts()).toEqual([signedIn.primaryAccountId]);

      const newAccountId = await openAccountPage.openNewAccount(accountType, signedIn.primaryAccountId);
      expect(newAccountId, 'the new account number differs from the source').not.toBe(signedIn.primaryAccountId);

      // The opening deposit is drained from a queue; wait for it to land rather
      // than racing it with an immediate read.
      const sourceAfter = dollarsToCents(
        await settle.balanceChangedFrom(signedIn.primaryAccountId, sourceBeforeDollars),
      );
      const created = await bankApi.getAccount(newAccountId);

      const deposit = sourceBefore - sourceAfter;
      expect(deposit, 'an opening deposit left the source account').toBeGreaterThan(0);
      expect(dollarsToCents(created.balance), `the deposit of ${formatCents(deposit)} arrived intact`).toBe(deposit);
      expect(created.type, 'the account was opened as the type that was chosen').toBe(accountType);
      expect(created.customerId, 'the account belongs to this customer').toBe(signedIn.customerId);

      // And it is visible where a customer would look for it.
      await overviewPage.open();
      const rows = await overviewPage.readAccountRows();
      const newRow = rows.find((row) => row.accountId === newAccountId);
      expect(newRow, `account ${newAccountId} is missing from Accounts Overview`).toBeDefined();
      expect(newRow!.balance).toBe(deposit);

      // Conservation: money moved between the customer's own accounts, so the
      // total is exactly what it was.
      expect(await overviewPage.readTotal(), 'opening an account must not change the total').toBe(
        rows.reduce((sum, row) => sum + row.balance, 0),
      );
      expect(rows.reduce((sum, row) => sum + row.balance, 0), 'no money was created or destroyed').toBe(
        sourceBefore,
      );
    });
  }

  test('TC17 — the account detail matches the overview row and the backend record', async ({
    signedIn,
    overviewPage,
    activityPage,
    bankApi,
  }) => {
    await overviewPage.open();
    const rows = await overviewPage.readAccountRows();
    expect(rows.length, 'there is an account to open').toBeGreaterThan(0);
    const row = rows[0];
    expect(row.accountId, 'the row is the registration account').toBe(signedIn.primaryAccountId);

    // Reached the way a customer reaches it: by clicking the number.
    await overviewPage.accountLink(row.accountId).click();
    await activityPage.adopt(row.accountId);

    const account = await bankApi.getAccount(row.accountId);

    await expect(activityPage.accountNumber).toHaveText(String(row.accountId));
    await expect(activityPage.accountType).toHaveText(account.type);
    expect(await activityPage.readBalance(), 'detail balance vs overview row').toBe(row.balance);
    expect(await activityPage.readBalance(), 'detail balance vs backend').toBe(dollarsToCents(account.balance));

    const available = await activityPage.availableBalance.innerText();
    expect(available.trim(), 'available amount').toBe(formatCents(Math.max(row.balance, 0)));

    // A brand-new account has no history, and the page says so rather than
    // rendering an empty table.
    await expect(activityPage.noTransactionsMessage).toBeVisible();
    await expect(activityPage.transactionRows).toHaveCount(0);
  });
});
