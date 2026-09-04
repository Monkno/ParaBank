import { test as base } from '@playwright/test';
import { AUTHENTICATED_BANK_API, BankApi, PUBLIC_BANK_API, settleWith, type Settler } from '../support/api';
import { buildCustomer } from '../data/factories';
import { CustomerFlow, type BankSession } from '../flows/CustomerFlow';
import { SessionFlow } from '../flows/SessionFlow';
import { HomePage } from '../pages/HomePage';
import { RegisterPage } from '../pages/RegisterPage';
import { LookupPage } from '../pages/LookupPage';
import { ContactPage } from '../pages/ContactPage';
import { OverviewPage } from '../pages/OverviewPage';
import { AccountActivityPage } from '../pages/AccountActivityPage';
import { OpenAccountPage } from '../pages/OpenAccountPage';
import { TransferPage } from '../pages/TransferPage';
import { BillPayPage } from '../pages/BillPayPage';
import { FindTransactionsPage } from '../pages/FindTransactionsPage';
import { RequestLoanPage } from '../pages/RequestLoanPage';
import { UpdateProfilePage } from '../pages/UpdateProfilePage';
import type { Customer } from '../data/types';

export interface Fixtures {
  /**
   * The bank's REST API as a signed-in user sees it, sharing the browser
   * context's `JSESSIONID` through `page.request`. This is the backend side of
   * every balance assertion.
   */
  bankApi: BankApi;

  /**
   * The same resource on its unauthenticated mount, over an API context that
   * carries no cookies. Used only by `tests/api/rest.spec.ts`, where "this
   * answers without a session" is the finding under test.
   */
  publicBankApi: BankApi;

  /**
   * Waits for ParaBank's asynchronous money movement to land before a balance or
   * transaction is read. Every arithmetic assertion in section C funnels through
   * this rather than reading the API the instant the banner appears — see
   * `settleWith` in `src/support/api.ts`.
   */
  settle: Settler;

  homePage: HomePage;
  registerPage: RegisterPage;
  lookupPage: LookupPage;
  contactPage: ContactPage;
  overviewPage: OverviewPage;
  activityPage: AccountActivityPage;
  openAccountPage: OpenAccountPage;
  transferPage: TransferPage;
  billPayPage: BillPayPage;
  findTransactionsPage: FindTransactionsPage;
  requestLoanPage: RequestLoanPage;
  updateProfilePage: UpdateProfilePage;

  customerFlow: CustomerFlow;
  session: SessionFlow;

  /** A fresh, unregistered customer. Unique per worker and per millisecond. */
  customerData: Customer;

  /**
   * A customer that exists and whose browser is signed in, sitting on Accounts
   * Overview. The precondition for everything in section C.
   */
  signedIn: BankSession;

  /**
   * A customer that exists and whose browser is signed *out*, sitting on the
   * home page.
   *
   * The distinction is the point: TC09 ("log in and verify the private area")
   * and TC14 ("recover the login of an existing customer") are meaningless if
   * the fixture hands over an open session the test has to undo first.
   */
  signedOut: BankSession;
}

/**
 * ParaBank's template renders sixteen images per page — the logo, a spacer GIF
 * repeated a dozen times, and CSS background art. Measured over three page
 * loads: 62 requests issued, 47 of them images. With this route in place the
 * same three loads put 15 requests on the wire instead of 62 - a 76% cut in
 * the only thing the rate limit counts, spent on pixels no assertion reads.
 *
 * This is blocking for *stability*, not speed. The shared demo sits behind a
 * Cloudflare rate limit that counts requests, and tripping it fails the whole
 * run for five minutes (see `src/support/edge.ts`). Cutting three quarters of
 * the traffic is the difference between a suite that can run twice in a row and
 * one that cannot.
 *
 * Only the image pattern is routed. Intercepting every request would funnel the
 * whole page load through the driver, which is both slower and a behaviour
 * change; stylesheets and scripts are left alone because layout drives
 * `innerText` and visibility, and jQuery drives every private page.
 *
 * The URLs are matched with a trailing delimiter as well as end-of-string:
 * ParaBank appends the session id to static assets too, so the logo arrives
 * as images/logo.gif;jsessionid=<40 hex> and a glob ending in .gif misses it.
 */
const IMAGE_URL = /\.(gif|jpe?g|png|ico|svg|webp)(;|\?|$)/i;

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.route(IMAGE_URL, (route) => route.abort());
    await use(page);
  },

  bankApi: async ({ page }, use) => {
    await use(new BankApi(page.request, AUTHENTICATED_BANK_API));
  },

  publicBankApi: async ({ request }, use) => {
    await use(new BankApi(request, PUBLIC_BANK_API));
  },

  settle: async ({ bankApi }, use) => {
    await use(settleWith(bankApi));
  },

  homePage: async ({ page }, use) => use(new HomePage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  lookupPage: async ({ page }, use) => use(new LookupPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
  overviewPage: async ({ page }, use) => use(new OverviewPage(page)),
  activityPage: async ({ page }, use) => use(new AccountActivityPage(page)),
  openAccountPage: async ({ page }, use) => use(new OpenAccountPage(page)),
  transferPage: async ({ page }, use) => use(new TransferPage(page)),
  billPayPage: async ({ page }, use) => use(new BillPayPage(page)),
  findTransactionsPage: async ({ page }, use) => use(new FindTransactionsPage(page)),
  requestLoanPage: async ({ page }, use) => use(new RequestLoanPage(page)),
  updateProfilePage: async ({ page }, use) => use(new UpdateProfilePage(page)),

  customerFlow: async ({ page, bankApi }, use) => use(new CustomerFlow(page, bankApi)),
  session: async ({ page }, use) => use(new SessionFlow(page)),

  customerData: async ({}, use) => {
    await use(buildCustomer());
  },

  /**
   * Per-test and never per-worker. Half the cases in section C destroy or mutate
   * the shared resource — TC16 and TC24 add accounts, TC18 moves money,
   * TC26 rewrites the profile — so a worker-scoped customer would make the
   * second test in a worker depend on what the first one did to it, and a rerun
   * of the suite would not be a rerun.
   *
   * There is no teardown, and that is a finding rather than an omission:
   * ParaBank exposes no per-customer delete. The only disposal it offers is
   * `admin.htm?action=CLEAN` / `services/bank/cleanDB`, which wipe the database
   * for every user of the public demo and are out of bounds for this suite. See
   * STRATEGY.md, "Assumptions and trade-offs".
   */
  signedIn: async ({ customerFlow, customerData }, use) => {
    await use(await customerFlow.signUp(customerData));
  },

  signedOut: async ({ customerFlow, customerData, session }, use) => {
    const bankSession = await customerFlow.signUp(customerData);
    await session.signOut();
    await use(bankSession);
  },
});

export { expect } from '@playwright/test';
