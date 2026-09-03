import { test, expect } from '../../src/fixtures/test';
import { dollarsToCents, formatCents, parseUsd } from '../../src/support/money';

/**
 * TC18 and TC19 are one action verified at two levels — the balances that moved
 * and the entries the move left behind — so they share a single transfer. Doing
 * them separately would cost a second customer, a second account and a second
 * transfer on a shared, rate-limited demo and would prove nothing extra.
 */
test.describe('Transfer funds @accounts', () => {
  const AMOUNT = '37.42';
  const AMOUNT_CENTS = 3742;

  test('TC18 + TC19 — a transfer moves exactly the amount and is recorded on both accounts', async ({
    signedIn,
    openAccountPage,
    transferPage,
    activityPage,
    bankApi,
    settle,
  }) => {
    // A second account to transfer into. `Open New Account` is the only way a
    // customer can get one, so it is also the setup.
    await openAccountPage.open();
    const destinationId = await openAccountPage.openNewAccount('SAVINGS', signedIn.primaryAccountId);

    const sourceBeforeDollars = await bankApi.balanceOf(signedIn.primaryAccountId);
    const destinationBeforeDollars = await bankApi.balanceOf(destinationId);
    const sourceBefore = dollarsToCents(sourceBeforeDollars);
    const destinationBefore = dollarsToCents(destinationBeforeDollars);
    expect(
      sourceBefore,
      `the source account holds at least ${formatCents(AMOUNT_CENTS)} to transfer`,
    ).toBeGreaterThan(AMOUNT_CENTS);

    await transferPage.open();
    await transferPage.submitTransfer(AMOUNT, signedIn.primaryAccountId, destinationId);
    await transferPage.expectCompleted();

    // The confirmation says what it did, in the amounts and accounts requested.
    expect(parseUsd(await transferPage.resultAmount.innerText())).toBe(AMOUNT_CENTS);
    await expect(transferPage.resultFromAccount).toHaveText(String(signedIn.primaryAccountId));
    await expect(transferPage.resultToAccount).toHaveText(String(destinationId));

    // TC18 proper: the banner is not the evidence, the balances are. Both legs
    // are queued, so wait for each to move before reading it.
    const sourceAfter = dollarsToCents(
      await settle.balanceChangedFrom(signedIn.primaryAccountId, sourceBeforeDollars),
    );
    const destinationAfter = dollarsToCents(
      await settle.balanceChangedFrom(destinationId, destinationBeforeDollars),
    );

    expect(sourceBefore - sourceAfter, 'debited from the source').toBe(AMOUNT_CENTS);
    expect(destinationAfter - destinationBefore, 'credited to the destination').toBe(AMOUNT_CENTS);
    expect(
      sourceAfter + destinationAfter,
      'a transfer between two accounts changes neither the sum nor anything else',
    ).toBe(sourceBefore + destinationBefore);

    // TC19: the entry a customer would see on the receiving account. Wait for
    // the transaction to be booked before opening the statement, or the page
    // shows "No transactions found." and the read races the queue.
    await settle.atLeastTransactions(destinationId, 1);
    await activityPage.openFor(destinationId);
    const credits = (await activityPage.readTransactions()).filter((row) => row.credit === AMOUNT_CENTS);
    expect(credits, `a ${formatCents(AMOUNT_CENTS)} credit on account ${destinationId}`).toHaveLength(1);
    expect(credits[0].description).toBe('Funds Transfer Received');
    expect(credits[0].debit, 'a credit row carries nothing in the debit column').toBeNull();
    expect(await activityPage.readBalance(), 'the detail page agrees with the API').toBe(destinationAfter);

    // And the matching entry on the account it left.
    await settle.atLeastTransactions(signedIn.primaryAccountId, 1);
    await activityPage.openFor(signedIn.primaryAccountId);
    const debits = (await activityPage.readTransactions()).filter((row) => row.debit === AMOUNT_CENTS);
    expect(debits, `a ${formatCents(AMOUNT_CENTS)} debit on account ${signedIn.primaryAccountId}`).toHaveLength(1);
    expect(debits[0].description).toBe('Funds Transfer Sent');
  });

  /**
   * A negative path the published cases omit. `transfer.htm` ships two hidden
   * paragraphs — "The amount cannot be empty." and "Please enter a valid
   * amount." — and never shows either: the only code that would has the selector
   * `$('#amount.errors')`, which means "the element with id `amount` and class
   * `errors`" and matches nothing. Submitting an empty amount therefore posts
   * `amount=` to the backend, gets HTTP 400, and the customer is shown the
   * generic "An internal error has occurred and has been logged."
   *
   * Asserted as observed, and recorded as defect D12.
   */
  test('D12 — an empty transfer amount shows an internal error instead of the validation message', async ({
    signedIn,
    openAccountPage,
    transferPage,
    bankApi,
  }) => {
    await openAccountPage.open();
    const destinationId = await openAccountPage.openNewAccount('SAVINGS', signedIn.primaryAccountId);
    const sourceBefore = dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId));

    await transferPage.open();
    await transferPage.submitTransfer('', signedIn.primaryAccountId, destinationId);

    await expect(transferPage.errorPanel).toBeVisible();
    await expect(transferPage.errorPanel).toContainText(
      'An internal error has occurred and has been logged.',
    );
    await expect(transferPage.resultPanel).toBeHidden();

    // The messages the page was written to show are present and were not shown.
    // Their count is also the second half of the defect: both carry the id
    // "amount.errors", so the document has a duplicate id.
    await expect(transferPage.authoredAmountErrors).toHaveCount(2);
    await expect(transferPage.authoredAmountErrors.first()).toBeHidden();
    await expect(transferPage.authoredAmountErrors.last()).toBeHidden();

    expect(
      dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId)),
      'a rejected transfer must not move money',
    ).toBe(sourceBefore);
  });
});
