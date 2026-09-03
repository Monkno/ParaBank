import { test, expect } from '../../src/fixtures/test';

/**
 * D15 — the session id travels in the URL.
 *
 * On the first request of a session, ParaBank rewrites every internal link to
 * `page.htm;jsessionid=<40 hex chars>`. A session identifier in a URL leaks
 * through the browser history, the `Referer` header sent to the third-party
 * links in the same footer, bookmarks, and any proxy or access log in between —
 * and ParaBank's own session cookie is set at the same time, so the rewriting
 * buys nothing.
 *
 * This is also why every page object in this suite navigates by an absolute
 * clean path and no test ever reuses a URL it read off the page: a hard-coded
 * `jsessionid` would bind the whole suite to one dead session.
 */
test.describe('Session hygiene @public', () => {
  test('D15 — internal links carry the session id in the URL', async ({ page }) => {
    // A brand-new context, so this is the first request of a fresh session and
    // the server has not yet learned that the client accepts cookies.
    await page.goto('/parabank/index.htm');
    await page.waitForLoadState('load');

    const internalHrefs = await page.locator('a[href$=".htm"], a[href*=".htm;"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    expect(internalHrefs.length, 'the home page has internal links to inspect').toBeGreaterThan(0);

    const rewritten = internalHrefs.filter((href) => /;jsessionid=[0-9A-F]{20,}/i.test(href));
    expect(
      rewritten.length,
      `internal links rewritten with a session id, out of ${internalHrefs.length}`,
    ).toBeGreaterThan(0);

    // And the same identifier is in the cookie jar, so the URL copy is pure leak.
    const cookies = await page.context().cookies();
    const jsessionid = cookies.find((cookie) => cookie.name === 'JSESSIONID');
    expect(jsessionid, 'a JSESSIONID cookie was also set').toBeDefined();
    expect(
      rewritten.some((href) => href.toUpperCase().includes(jsessionid!.value.toUpperCase())),
      'the id in the URL is the same session id that is in the cookie',
    ).toBe(true);
  });

  /**
   * D16 — the sign-out redirect names the server's persistence layer.
   *
   * `GET /parabank/logout.htm` answers 302 to `index.htm?ConnType=JDBC`. The
   * browser then follows a second redirect that strips the parameter again, so
   * the leak never shows in the address bar and has to be read off the Location
   * header. Free reconnaissance for anyone watching, and asserted here so a fix
   * is noticed.
   *
   * Measured: the parameter is present when the caller has no server-side
   * session and absent when it has one, which is why this case runs on the
   * public shell rather than inside TC12.
   */
  test('D16 — the logout redirect discloses the backend connection type', async ({ page }) => {
    await page.goto('/parabank/index.htm');

    const response = await page.request.get('/parabank/logout.htm', { maxRedirects: 0 });
    expect(response.status(), 'GET logout.htm').toBe(302);
    expect(
      response.headers()['location'] ?? '',
      'the logout redirect discloses the backend connection type',
    ).toContain('ConnType=JDBC');
  });
});
