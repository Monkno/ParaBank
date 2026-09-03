import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';

/** `/parabank/transfer.htm`. */
export class TransferPage extends BasePage {
  protected readonly path = '/parabank/transfer.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#showForm h1.title');
  }

  /** Both selects are filled by the same AJAX call; the first option proves it
   *  landed. Attachment, not visibility — an `<option>` in a collapsed
   *  `<select>` is never visible. */
  override async expectLoaded(): Promise<void> {
    await super.expectLoaded();
    await expect(this.fromAccountSelect.locator('option').first()).toBeAttached();
    await expect(this.toAccountSelect.locator('option').first()).toBeAttached();
  }

  get amountInput(): Locator {
    return this.page.locator('#amount');
  }

  get fromAccountSelect(): Locator {
    return this.page.locator('#fromAccountId');
  }

  get toAccountSelect(): Locator {
    return this.page.locator('#toAccountId');
  }

  get submitButton(): Locator {
    return this.page.locator('#transferForm input[type="submit"]');
  }

  get resultPanel(): Locator {
    return this.page.locator('#showResult');
  }

  get resultAmount(): Locator {
    return this.page.locator('#amountResult');
  }

  get resultFromAccount(): Locator {
    return this.page.locator('#fromAccountIdResult');
  }

  get resultToAccount(): Locator {
    return this.page.locator('#toAccountIdResult');
  }

  get errorPanel(): Locator {
    return this.page.locator('#showError');
  }

  /**
   * The two authored amount-validation messages. They are in the markup of every
   * transfer page and the application has no code path that shows them: the only
   * reference is `$('#amount.errors')`, which reads as "id `amount` AND class
   * `errors`" and matches nothing. Both also share one id — see D12.
   */
  get authoredAmountErrors(): Locator {
    return this.page.locator('#showForm p[id="amount.errors"]');
  }

  /**
   * Fills and submits. The form's own `submit` handler calls `preventDefault()`;
   * if it has not been bound the browser performs a native GET on `transfer.htm`
   * and the transfer silently does not happen, which is why `expectLoaded()`
   * gates on the AJAX-populated select rather than on the visible button.
   */
  async submitTransfer(amount: string, fromAccountId: number, toAccountId: number): Promise<void> {
    await this.amountInput.fill(amount);
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.toAccountSelect.selectOption(String(toAccountId));
    await this.submitButton.click();
  }

  async expectCompleted(): Promise<void> {
    await expect(this.resultPanel).toBeVisible();
  }
}
