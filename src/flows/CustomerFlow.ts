import { expect, type Page } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';
import { OverviewPage } from '../pages/OverviewPage';
import type { BankApi } from '../support/api';
import type { Customer } from '../data/types';

export interface BankSession {
  /** Exactly what was typed into the registration form. Every profile and
   *  lookup assertion compares against this, so nothing is hard-coded. */
  customer: Customer;
  customerId: number;
  /** The CHECKING account ParaBank opens automatically at registration. */
  primaryAccountId: number;
}

/**
 * Creating a customer, end to end, for every test that needs one.
 *
 * This crosses two pages plus the REST API and is the single most-used sequence
 * in the suite, which is why it is a flow and not a page method.
 *
 * The customer id is *discovered*, never assumed. ParaBank does not print it
 * anywhere a user can see: it appears only inside the inline JavaScript of the
 * private pages. Scraping that would couple the suite to a script literal, so
 * instead the flow reads the account number the overview renders and asks the
 * API which customer owns it. That also proves, as a side effect, that the
 * account the UI shows and the account the backend holds are the same object.
 */
export class CustomerFlow {
  private readonly registerPage: RegisterPage;
  private readonly overviewPage: OverviewPage;

  constructor(
    page: Page,
    private readonly api: BankApi,
  ) {
    this.registerPage = new RegisterPage(page);
    this.overviewPage = new OverviewPage(page);
  }

  /** Fills and submits the registration form, and insists it was accepted. */
  async register(customer: Customer): Promise<void> {
    await this.registerPage.open();
    await this.registerPage.fill(customer);
    await this.registerPage.fillRepeatedPassword(customer.password);
    await this.registerPage.submit();

    // A duplicate username or a validation failure re-renders the form instead
    // of erroring, so a run that silently did not register would otherwise fail
    // later with an unrelated message.
    await expect(
      this.registerPage.confirmationHeading,
      `registration of "${customer.username}" was rejected: ${await this.rejectionReason()}`,
    ).toHaveText(`Welcome ${customer.username}`);
  }

  /** Registers and returns everything downstream tests need. Leaves the browser
   *  signed in, which is what ParaBank does after a successful registration. */
  async signUp(customer: Customer): Promise<BankSession> {
    await this.register(customer);

    await this.overviewPage.open();
    const rows = await this.overviewPage.readAccountRows();
    if (rows.length === 0) {
      throw new Error(`Accounts Overview listed no accounts for the freshly registered "${customer.username}"`);
    }

    const primaryAccountId = rows[0].accountId;
    const account = await this.api.getAccount(primaryAccountId);

    return { customer, customerId: account.customerId, primaryAccountId };
  }

  /** Best-effort detail for the failure message above; never throws. */
  private async rejectionReason(): Promise<string> {
    const errors = await this.registerPage.allErrors.allInnerTexts().catch(() => []);
    return errors.length > 0 ? errors.join(' | ') : '(no field errors rendered)';
  }
}
