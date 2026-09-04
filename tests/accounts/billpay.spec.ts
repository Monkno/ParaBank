import { test, expect } from '../../src/fixtures/test';
import { dollarsToCents } from '../../src/support/money';

test.describe('Bill Pay @accounts', () => {
  test('TC21 — an empty Bill Pay form reports every field and pays nothing', async ({
    signedIn,
    billPayPage,
    bankApi,
  }) => {
    const before = dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId));

    await billPayPage.open();
    await billPayPage.submit();

    // Exhaustive: the exact set of messages the page shows, so an extra or a
    // missing one fails. Note "Account number is required." appears twice —
    // once for Account # and once for Verify Account #.
    await expect(billPayPage.visibleValidationErrors).toHaveText([
      'Payee name is required.',
      'Address is required.',
      'City is required.',
      'State is required.',
      'Zip Code is required.',
      'Phone number is required.',
      'Account number is required.',
      'Account number is required.',
      'The amount cannot be empty.',
    ]);

    await expect(billPayPage.resultPanel).toBeHidden();
    await expect(billPayPage.errorPanel).toBeHidden();
    expect(
      dollarsToCents(await bankApi.balanceOf(signedIn.primaryAccountId)),
      'an unsubmitted payment must not move money',
    ).toBe(before);
  });
});
