import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import type { Payee } from '../data/types';

/**
 * `/parabank/billpay.htm`.
 *
 * The payee fields are addressed by `name`: the Phone # input's `id` is a fresh
 * random UUID on every page load (`id="291d27d1-bc7a-..."`), so any id-based
 * locator for it is a guess that breaks on the next request.
 */
export class BillPayPage extends BasePage {
  protected readonly path = '/parabank/billpay.htm';

  constructor(page: Page) {
    super(page);
  }

  /** Unlike transfer/openaccount, the source-account select is server-rendered
   *  here, so the heading is the identity marker and `waitForHandlersBound()`
   *  covers the script binding. */
  protected uniqueMarker(): Locator {
    return this.page.locator('#billpayForm h1.title');
  }

  field(name: string): Locator {
    return this.page.locator(`#billpayForm [name="${name}"]`);
  }

  get fromAccountSelect(): Locator {
    return this.page.locator('#billpayForm select[name="fromAccountId"]');
  }

  get submitButton(): Locator {
    return this.page.locator('#billpayForm input[type="button"]');
  }

  get visibleValidationErrors(): Locator {
    return this.page.locator('#billpayForm span.error:visible');
  }

  get resultPanel(): Locator {
    return this.page.locator('#billpayResult');
  }

  get resultPayeeName(): Locator {
    return this.page.locator('#billpayResult #payeeName');
  }

  get resultAmount(): Locator {
    return this.page.locator('#billpayResult #amount');
  }

  get resultFromAccount(): Locator {
    return this.page.locator('#billpayResult #fromAccountId');
  }

  get errorPanel(): Locator {
    return this.page.locator('#billpayError');
  }

  /** Fills the payee block; `verifyAccount` defaults to the payee account so the
   *  mismatch case (TC22) can override exactly one thing. */
  async fillPayment(
    payee: Payee,
    amount: string,
    fromAccountId: number,
    options: { verifyAccount?: string } = {},
  ): Promise<void> {
    await this.field('payee.name').fill(payee.name);
    await this.field('payee.address.street').fill(payee.street);
    await this.field('payee.address.city').fill(payee.city);
    await this.field('payee.address.state').fill(payee.state);
    await this.field('payee.address.zipCode').fill(payee.zipCode);
    await this.field('payee.phoneNumber').fill(payee.phoneNumber);
    await this.field('payee.accountNumber').fill(payee.accountNumber);
    await this.field('verifyAccount').fill(options.verifyAccount ?? payee.accountNumber);
    await this.field('amount').fill(amount);
    await this.fromAccountSelect.selectOption(String(fromAccountId));
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async expectCompleted(): Promise<void> {
    await expect(this.resultPanel).toBeVisible();
  }
}
