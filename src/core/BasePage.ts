import { expect, type Locator, type Page } from '@playwright/test';
import { settleEdge } from '../support/edge';

/**
 * Common ground for every page object. A subclass declares only `path` and
 * `uniqueMarker()`; `open()`, `expectLoaded()` and the navigation error message
 * come for free.
 *
 * ParaBank is a server-rendered Java application, but its *private* pages are a
 * hybrid: the JSP ships an empty shell and an inline `$(document).ready(...)`
 * block that both fills the controls from `services_proxy/bank/...` and binds
 * the click handlers. Two consequences drive the design here:
 *
 *   1. Every control on `transfer.htm`, `billpay.htm`, `openaccount.htm`,
 *      `findtrans.htm`, `requestloan.htm` and `updateprofile.htm` is visible,
 *      stable and clickable *before* it does anything. `findtrans.htm`'s buttons
 *      are `type="submit"` inside a `<form>` whose handlers call
 *      `preventDefault()`; click one before the handler is bound and the browser
 *      does a native GET submit and the search silently never happens.
 *      `waitForHandlersBound()` below is the single named defence.
 *   2. `expectLoaded()` cannot just look for the form — the form is in the DOM
 *      from the first byte. Each page's marker is something only the successful
 *      AJAX produces.
 */
export abstract class BasePage {
  /** Path relative to baseURL, e.g. `/parabank/overview.htm`. */
  protected abstract path: string;

  protected constructor(protected readonly page: Page) {}

  /** A locator that exists only once this page is genuinely usable. */
  protected abstract uniqueMarker(): Locator;

  async open(): Promise<void> {
    await this.gotoPath(this.path);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await this.waitForHandlersBound();
    await expect(this.uniqueMarker()).toBeVisible();
  }

  /**
   * Navigate without asserting the status, and report it.
   *
   * Used by the authorization cases (TC13), where the HTTP status *is* the
   * observation: ParaBank answers an unauthenticated `overview.htm` with 500 and
   * a generic error page rather than a redirect to the login (defect D03).
   */
  async openRaw(): Promise<number> {
    const status = await settleEdge(this.page, this.path, await this.page.goto(this.path));
    await this.waitForHandlersBound();
    return status;
  }

  /**
   * Navigation with an HTTP-level failure message. A shared demo that answers
   * 503 should read as "GET /parabank/overview.htm returned HTTP 503", not as an
   * unexplained locator timeout a minute later.
   *
   * `settleEdge` sits in between because the host is behind Cloudflare, whose
   * bot challenge and rate-limit pages arrive as 403 and 429 and mean entirely
   * different things — see `src/support/edge.ts`.
   */
  protected async gotoPath(path: string): Promise<void> {
    const status = await settleEdge(this.page, path, await this.page.goto(path));
    if (status >= 400) {
      throw new Error(`GET ${path} returned HTTP ${status}`);
    }
  }

  /**
   * Waits for the inline scripts at the end of the document to have run, so a
   * click on a JS-bound control is not swallowed.
   *
   * `load` and not `domcontentloaded`: jQuery's `$(document).ready` fires on
   * DOMContentLoaded, and waiting for the *same* event is a coin flip on
   * ordering. `load` is strictly later and costs nothing here — these pages
   * carry one 90 KB script and no images of consequence.
   */
  protected async waitForHandlersBound(): Promise<void> {
    await this.page.waitForLoadState('load');
  }
}
