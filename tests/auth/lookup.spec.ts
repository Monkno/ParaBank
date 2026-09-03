import { test, expect } from '../../src/fixtures/test';
import { buildCustomer } from '../../src/data/factories';

/**
 * "Forgot login info?" — `lookup.htm`.
 *
 * The application answers a match by printing the username *and the password in
 * clear text*, and opening a session for the caller. These cases assert what it
 * does, because that is what a regression would change; the fact that it should
 * not do it at all is recorded as defect D02.
 */
test.describe('Forgot login info @auth', () => {
  test('TC14 — matching personal details return the customer\'s credentials', async ({
    signedOut,
    lookupPage,
    session,
  }) => {
    await lookupPage.open();
    await lookupPage.lookUp(signedOut.customer);

    await expect(lookupPage.statusMessage).toHaveText(
      'Your login information was located successfully. You are now logged in.',
    );

    // Both credentials are compared against what this test registered, so
    // nothing is hard-coded and the assertion cannot pass against a stale
    // customer left behind by another run.
    const credentials = (await lookupPage.credentialsParagraph.innerText()).replace(/\s+/g, ' ').trim();
    expect(credentials).toBe(
      `Username: ${signedOut.customer.username} Password: ${signedOut.customer.password}`,
    );

    // D02, the part with teeth: the lookup did not just tell you the password,
    // it signed you in. Knowing a name, an address and an SSN is enough to take
    // over the account, and `GET /services/bank/customers/{id}` hands all three
    // to an anonymous caller (D01).
    await session.expectSignedIn(signedOut.customer);
  });

  /**
   * The negative path the published cases omit. One field is wrong and
   * everything else is right, so the only thing that can cause the refusal is
   * that field.
   */
  test('TC14 — a wrong SSN is not enough to recover a login', async ({
    signedOut,
    lookupPage,
    page,
    session,
  }) => {
    await lookupPage.open();
    await lookupPage.lookUp({ ...signedOut.customer, ssn: buildCustomer().ssn });

    await expect(page.locator('#rightPanel h1.title')).toHaveText('Error!');
    await expect(page.locator('#rightPanel p.error')).toHaveText(
      'The customer information provided could not be found.',
    );
    await session.expectSignedOut();
  });

  test('TC14 — an empty lookup reports every required field', async ({ lookupPage }) => {
    await lookupPage.open();
    await lookupPage.submitButton.click();

    await expect(lookupPage.allErrors).toHaveText([
      'First name is required.',
      'Last name is required.',
      'Address is required.',
      'City is required.',
      'State is required.',
      // DOM order, not form order: lookup.htm emits the SSN error last even
      // though the SSN field sits below Zip Code on screen.
      'Zip Code is required.',
      'Social Security Number is required.',
    ]);
  });

  /**
   * D05 — `updateprofile.htm` inlines the signed-in customer's username *and
   * password* into the page as literal JavaScript, so that its "save" call can
   * append them to a query string:
   *
   *     "&ssn=" + encodeURIComponent(customer.ssn) +
   *     "&username=qa01788470521&password=Passw0rd1";
   *
   * The password therefore reaches the browser in clear text on every visit to
   * the page, and is then sent in a URL, where it lands in access logs and the
   * Referer header. Asserted so that a fix is noticed.
   */
  test('D05 — Update Contact Info inlines the customer password into the page source', async ({
    signedIn,
    updateProfilePage,
    page,
  }) => {
    await updateProfilePage.open();

    const source = await page.content();
    expect(source, 'the page source contains the customer password in clear text').toContain(
      `password=${signedIn.customer.password}`,
    );
    expect(source, 'and the username alongside it').toContain(`username=${signedIn.customer.username}`);
  });
});
