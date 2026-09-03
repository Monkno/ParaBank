import { test, expect } from '../../src/fixtures/test';
import { dollarsToCents, formatCents } from '../../src/support/money';

/**
 * Loan requests. TC24 and TC25 are kept apart rather than parameterised: an
 * approval and a denial share the form and nothing else. One asserts that a new
 * LOAN account exists and that the down payment left the funding account, the
 * other asserts that neither happened. Folding them into one parameterised test
 * would mean a body full of `if (approved)`, which is two tests wearing a
 * costume.
 */
test.describe('Request loan @accounts', () => {
  test('TC24 — an approved loan takes the down payment and opens a funded LOAN account', async ({
    signedIn,
    requestLoanPage,
    overviewPage,
    bankApi,
    settle,
  }) => {
    const LOAN_AMOUNT_CENTS = 100_000; // $1,000.00
    const DOWN_PAYMENT_CENTS = 10_000; // $100.00

    const fundingBeforeDollars = await bankApi.balanceOf(signedIn.primaryAccountId);
    const fundingBefore = dollarsToCents(fundingBeforeDollars);
    expect(
      fundingBefore,
      `the funding account covers the ${formatCents(DOWN_PAYMENT_CENTS)} down payment`,
    ).toBeGreaterThanOrEqual(DOWN_PAYMENT_CENTS);
    const accountsBefore = await bankApi.listAccounts(signedIn.customerId);

    await requestLoanPage.open();
    const outcome = await requestLoanPage.apply('1000', '100', signedIn.primaryAccountId);

    expect(
      outcome.status,
      'ParaBank approves a 10% down payment against a funded account. If this ' +
        'flipped to Denied, the server-side loanProcessorThreshold was changed ' +
        'through admin.htm — see STRATEGY.md.',
    ).toBe('Approved');
    expect(outcome.providerName, 'the result names the provider that decided').not.toBe('');
    expect(outcome.newAccountId).not.toBeNull();

    const loanAccountId = outcome.newAccountId as number;
    // The loan account is created at 0 and funded off the queue; wait for it.
    await settle.balanceChangedFrom(loanAccountId, 0);
    const loanAccount = await bankApi.getAccount(loanAccountId);
    expect(loanAccount.type, 'the account opened for the loan').toBe('LOAN');
    expect(loanAccount.customerId).toBe(signedIn.customerId);
    expect(dollarsToCents(loanAccount.balance), 'the loan account holds the amount lent').toBe(
      LOAN_AMOUNT_CENTS,
    );

    // The down payment, and only the down payment, left the funding account —
    // once the queue has drained it.
    const fundingAfter = dollarsToCents(
      await settle.balanceChangedFrom(signedIn.primaryAccountId, fundingBeforeDollars),
    );
    expect(fundingBefore - fundingAfter, 'the down payment was taken').toBe(DOWN_PAYMENT_CENTS);

    // And the customer can see the new account where they would look for it.
    const accountsAfter = await bankApi.listAccounts(signedIn.customerId);
    expect(accountsAfter.length, 'exactly one account was added').toBe(accountsBefore.length + 1);

    await overviewPage.open();
    const rows = await overviewPage.readAccountRows();
    const loanRow = rows.find((row) => row.accountId === loanAccountId);
    expect(loanRow, `the loan account ${loanAccountId} is missing from Accounts Overview`).toBeDefined();
    expect(loanRow!.balance).toBe(LOAN_AMOUNT_CENTS);
  });

  test('TC25 — a loan far beyond the available funds is denied and creates nothing', async ({
    signedIn,
    requestLoanPage,
    bankApi,
  }) => {
    const fundingBefore = dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId));
    const accountsBefore = await bankApi.listAccounts(signedIn.customerId);

    await requestLoanPage.open();
    const outcome = await requestLoanPage.apply('1000000', '10', signedIn.primaryAccountId);

    expect(outcome.status).toBe('Denied');
    expect(outcome.newAccountId, 'a denied loan opens no account').toBeNull();
    // The page explains itself rather than showing an empty error paragraph.
    expect(outcome.denialReason, 'the denial names its reason').toBe(
      'We cannot grant a loan in that amount with your available funds.',
    );

    expect(
      dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId)),
      'a denied loan must not take the down payment',
    ).toBe(fundingBefore);
    expect(
      (await bankApi.listAccounts(signedIn.customerId)).map((account) => account.id),
      'a denied loan must not add an account',
    ).toEqual(accountsBefore.map((account) => account.id));
  });

  /**
   * An oddity found while measuring TC24, kept because it is the sort of thing a
   * reconciliation would trip over: the money lent appears as the LOAN account's
   * balance, but the account has no transaction to explain where it came from.
   * The down payment, by contrast, is booked on the funding account.
   */
  });
