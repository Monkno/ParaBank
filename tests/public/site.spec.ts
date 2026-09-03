import { test, expect } from '../../src/fixtures/test';

/**
 * The public shell. Nothing here signs in, so nothing here writes to the shared
 * database — these are the only cases in the suite that leave no trace.
 */
test.describe('Public site @public', () => {
  test('TC01 — the home page carries the login panel, the news list and the service lists', async ({
    homePage,
    page,
  }) => {
    await homePage.open();

    await expect(page).toHaveTitle('ParaBank | Welcome | Online Banking');

    // Customer Login: the three controls a customer needs, plus the two ways out.
    await expect(homePage.login.usernameInput).toBeVisible();
    await expect(homePage.login.passwordInput).toBeVisible();
    await expect(homePage.login.submitButton).toHaveValue('Log In');
    await expect(homePage.login.registerLink).toHaveText('Register');
    await expect(homePage.login.forgotLoginLink).toHaveText('Forgot login info?');

    // The password field must actually mask input; `type` is the only thing
    // that makes that true and it is one attribute away from being wrong.
    await expect(homePage.login.passwordInput).toHaveAttribute('type', 'password');

    // Informational blocks. Counted, not merely "visible": an empty <ul> is
    // visible too, and every headline assertion below would pass against it.
    const headlines = await homePage.newsHeadlines.allInnerTexts();
    expect(headlines.length, 'Latest News headlines').toBeGreaterThan(0);
    for (const headline of headlines) {
      expect(headline.trim(), 'a headline with no text is a broken link').not.toBe('');
    }

    expect((await homePage.atmServices.allInnerTexts()).length, 'ATM Services entries').toBeGreaterThan(0);
    expect((await homePage.onlineServices.allInnerTexts()).length, 'Online Services entries').toBeGreaterThan(0);

    // Documented finding D06, asserted rather than described: an administration
    // console is linked from the public banner. The suite never follows it.
    await expect(homePage.adminLink).toHaveCount(1);
  });

  /**
   * The five internal destinations reachable from the footer. Each is clicked,
   * its navigation response status is read, and its own content is asserted —
   * "responds 200" alone would pass on ParaBank's generic error page, which is
   * also served with a 200 in several places.
   *
   * `Services` is asserted against what the application actually renders, not
   * against what a page called "Services" ought to render: `services.htm` serves
   * an Apache CXF "Service list" for an unrelated Bookstore SOAP demo, with its
   * markup HTML-escaped so the raw tags show as text. That is defect D08; the
   * assertion follows the application and the case is annotated.
   */
  const destinations = [
    { label: 'Home', path: '/parabank/index.htm', title: 'ParaBank | Welcome | Online Banking', marker: '#rightPanel ul.events' },
    { label: 'About Us', path: '/parabank/about.htm', title: 'ParaBank | About Us', marker: '#rightPanel h1.title' },
    { label: 'Services', path: '/parabank/services.htm', title: 'ParaBank | Services', marker: '#rightPanel' },
    { label: 'Site Map', path: '/parabank/sitemap.htm', title: 'ParaBank | Site Map', marker: '#rightPanel ul' },
    { label: 'Contact Us', path: '/parabank/contact.htm', title: 'ParaBank | Customer Care', marker: '#contactForm' },
  ] as const;

  test('TC02 — every footer destination answers 200 and renders its own content', async ({ homePage, page }) => {
    for (const destination of destinations) {
      await homePage.open();

      const navigation = page.waitForResponse(
        (response) => response.request().isNavigationRequest() && response.url().includes(destination.path),
      );
      await homePage.footerLink(destination.label).click();
      const response = await navigation;

      expect(response.status(), `GET ${destination.path} (footer link "${destination.label}")`).toBe(200);
      await expect(page).toHaveTitle(destination.title);
      await expect(page.locator(destination.marker).first()).toBeVisible();
      await expect(page.locator('#rightPanel p.error')).toHaveCount(0);
    }
  });

  test('TC02 — About Us and Site Map render their documented content', async ({ page, homePage }) => {
    await homePage.open();
    await homePage.footerLink('About Us').click();
    await expect(page.locator('#rightPanel h1.title')).toHaveText('ParaSoft Demo Website');
    await expect(page.locator('#rightPanel')).toContainText('ParaBank is not a real bank!');

    await homePage.footerLink('Site Map').click();
    // The site map's job is to link to the private area; those links must be
    // present even though following them without a session fails (TC13).
    for (const path of ['overview.htm', 'transfer.htm', 'billpay.htm', 'findtrans.htm', 'requestloan.htm', 'updateprofile.htm']) {
      await expect(page.locator(`#rightPanel a[href*="${path}"]`), `site map link to ${path}`).toHaveCount(1);
    }
  });

  /**
   * D08, asserted so a fix is noticed. `services.htm` should describe ParaBank's
   * online services; it instead serves the CXF service list of the Parasoft
   * Bookstore SOAP demo, and publishes a WS-Security username and password in
   * the body. If this ever starts rendering the marketing copy, this test goes
   * red and the defect is closed.
   */
  test('D08 — the Services page serves a raw CXF service list instead of ParaBank content', async ({
    homePage,
    page,
  }) => {
    await homePage.open();
    await homePage.footerLink('Services').click();

    // innerText needs layout. Reading it on the very first tick after a
    // navigation returns an empty string, and an empty string passes nothing
    // here but silently fails the toContain below - measured, this test read
    // '' three runs out of three before the wait was added.
    await page.waitForLoadState('load');
    await expect(page.locator('#rightPanel table').first()).toBeVisible();

    const body = await page.locator('#rightPanel').innerText();
    expect(body, 'services.htm content').toContain('Available Bookstore SOAP services');
    expect(body, 'services.htm leaks the demo SOAP credentials').toContain('password:soatest');

    // The structural half of the defect: a complete second HTML document -
    // DOCTYPE, <html>, <head>, <title> and all - is injected inside
    // <div id="rightPanel">, so the rendered page ends up with a <title>
    // element sitting in its <body>. Counted rather than eyeballed, because a
    // fix that merely stripped the credentials would leave the page malformed.
    expect(
      await page.locator('body title').count(),
      'services.htm injects a whole second HTML document into the page body',
    ).toBeGreaterThan(0);
  });
});
