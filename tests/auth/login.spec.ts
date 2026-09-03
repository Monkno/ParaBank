import { test, expect } from '../../src/fixtures/test';
import { buildCustomer } from '../../src/data/factories';
import { dollarsToCents } from '../../src/support/money';

test.describe('Authentication @auth', () => {
  test('TC09 — valid credentials open the private area', async ({
    signedOut,
    session,
    overviewPage,
    bankApi,
  }) => {
    // `signedOut` is the precondition the case actually describes: an account
    // that exists, and a browser that has to log into it. Registration leaves a
    // session open, so handing that over would test nothing.
    await session.signIn(signedOut.customer.username, signedOut.customer.password);

    await session.expectSignedIn(signedOut.customer);
    await expect(overviewPage.heading).toHaveText('Accounts Overview');

    // The private area is showing this customer's data and not somebody else's.
    const rows = await overviewPage.readAccountRows();
    const accounts = await bankApi.listAccounts(signedOut.customerId);
    expect(rows.map((row) => row.accountId).sort()).toEqual(accounts.map((account) => account.id).sort());

    // The account-services menu is the private navigation; all eight entries.
    for (const label of [
      'Open New Account',
      'Accounts Overview',
      'Transfer Funds',
      'Bill Pay',
      'Find Transactions',
      'Update Contact Info',
      'Request Loan',
      'Log Out',
    ]) {
      await expect(overviewPage.menu.link(label), `menu entry "${label}"`).toHaveCount(1);
    }
  });

  /**
   * TC10 splits along its cost, not its data.
   *
   * A username that never existed needs no account, so it runs against the bare
   * home page. A correct username with the wrong password needs a real account,
   * which costs a registration. Parameterising the two together would declare
   * the `signedOut` fixture in one signature and make the cheap half pay for a
   * registration it does not use.
   */
      test('TC11 — an empty login form asks for both fields', async ({ homePage, session, page }) => {
    await homePage.open();
    await homePage.login.signIn('', '');

    await expect(page.locator('#rightPanel p.error')).toHaveText(
      'Please enter a username and password.',
    );
    await session.expectSignedOut();
  });

  test('TC12 — logging out ends the session and re-protects the private area', async ({
    signedIn,
    session,
    overviewPage,
    homePage,
    page,
  }) => {
    await session.expectSignedIn(signedIn.customer);

    await session.signOut();

    // Back on the public landing page, with its login panel.
    expect(new URL(page.url()).pathname, 'logout destination').toBe('/parabank/index.htm');
    await expect(homePage.login.submitButton).toBeVisible();

    // The session is genuinely gone, not merely navigated away from: the same
    // private URL that worked a moment ago is refused now.
    expect(await overviewPage.openRaw(), 'GET overview.htm after logging out').toBe(500);
    await expect(page.locator('#rightPanel p.error')).toHaveText(
      'An internal error has occurred and has been logged.',
    );
  });

  /**
   * TC13 — the private pages with no session at all.
   *
   * The case as written expects a redirect to the login or a session error.
   * ParaBank does neither: it answers HTTP 500 with the generic "An internal
   * error has occurred and has been logged." page. The assertion follows the
   * application; the mismatch is recorded as defect D03 rather than smoothed
   * over by loosening the check to "some error appears".
   *
   * Each page object is used for its `path`, so a URL change is a compile error
   * rather than a stale literal in a test.
   */
  test('TC13 — private pages are refused without a session', async ({
    overviewPage,
    transferPage,
    billPayPage,
    page,
  }) => {
    for (const [name, target] of [
      ['overview.htm', overviewPage],
      ['transfer.htm', transferPage],
      ['billpay.htm', billPayPage],
    ] as const) {
      expect(await target.openRaw(), `GET ${name} without a session`).toBe(500);
      await expect(page.locator('#rightPanel p.error'), `${name} error page`).toHaveText(
        'An internal error has occurred and has been logged.',
      );
      // Whatever it does show, it must not be somebody's accounts.
      await expect(page.locator('#accountTable tbody tr'), `${name} leaked account rows`).toHaveCount(0);
      await expect(page.locator('#leftPanel a[href*="logout.htm"]'), `${name} rendered the private menu`).toHaveCount(0);
    }

  });

  /**
   * D04 — `activity.htm` is the odd one out.
   *
   * Its three siblings answer an unauthenticated request with HTTP 500 and no
   * content. This one answers 200 and renders its whole shell, leaving the
   * refusal to the AJAX call behind it. Nothing escapes today, because the data
   * comes from the authenticated proxy — but the server-side guard that protects
   * the other three is simply absent here, and the page is one change away from
   * leaking. The account under test is one this test created.
   */
  test('D04 — activity.htm is served without a session while its siblings are refused', async ({
    signedOut,
    activityPage,
    page,
  }) => {
    expect(
      await activityPage.openRawFor(signedOut.primaryAccountId),
      'GET activity.htm without a session',
    ).toBe(200);

    // The shell really is ParaBank's account page and not the generic error page.
    await expect(page.locator('#accountDetails')).toHaveCount(1);
    // And the data behind it is refused, so nothing is disclosed.
    await expect(page.locator('#error'), 'the data behind it is still refused').toBeVisible();
    await expect(activityPage.accountNumber).toBeEmpty();
  });

  /**
   * D11 — horizontal privilege escalation.
   *
   * A gap the published cases do not cover, and the one that matters most on a
   * banking application: whether one customer's session can read another
   * customer's account. It can.
   *
   * Two customers are created, and the second opens the first's account detail
   * page by its number. The page renders the victim's account number, type and
   * balance in full. This is not the anonymous `services/bank` mirror (D01) —
   * it is the *authenticated* `services_proxy`, which checks that you are
   * logged in as somebody and never that you are logged in as the owner.
   *
   * The assertion is written as the application behaves, so that the day
   * ownership is enforced this test fails and the defect is closed.
   */
  test('D11 — a signed-in customer can read the account detail of another customer', async ({
    customerFlow,
    customerData,
    session,
    activityPage,
    bankApi,
  }) => {
    const victim = await customerFlow.signUp(customerData);
    const victimBalance = await bankApi.balanceOf(victim.primaryAccountId);
    await session.signOut();

    const attacker = await customerFlow.signUp(buildCustomer());
    expect(attacker.customerId, 'the two customers are distinct').not.toBe(victim.customerId);

    await activityPage.openFor(victim.primaryAccountId);

    await expect(activityPage.accountNumber).toHaveText(String(victim.primaryAccountId));
    expect(
      await activityPage.readBalance(),
      "the victim's balance is fully disclosed to another customer's session",
    ).toBe(dollarsToCents(victimBalance));
  });
});
