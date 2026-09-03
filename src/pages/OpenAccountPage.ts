import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import type { AccountType } from '../data/types';

/** `/parabank/openaccount.htm`. The `#type` select uses positional values. */
const TYPE_VALUE: Record<'CHECKING' | 'SAVINGS', string> = { CHECKING: '0', SAVINGS: '1' };

export class OpenAccountPage extends BasePage {
  protected readonly path = '/parabank/openaccount.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#openAccountForm h1.title');
  }

  /**
   * The source-account select is empty in the HTML and filled by AJAX, so page
   * identity is not enough — `selectOption` on an unpopulated select fails, and
   * the submit button does nothing useful before the accounts arrive.
   *
   * `toBeAttached` and not `toBeVisible`: an `<option>` inside a collapsed
   * `<select>` has no box and is never visible to Playwright. Waiting for
   * visibility here timed out on every run before this was corrected.
   */
  override async expectLoaded(): Promise<void> {
    await super.expectLoaded();
    await expect(this.fromAccountSelect.locator('option').first()).toBeAttached();
  }

  get typeSelect(): Locator {
    return this.page.locator('#type');
  }

  get fromAccountSelect(): Locator {
    return this.page.locator('#fromAccountId');
  }

  get submitButton(): Locator {
    return this.page.locator('#openAccountForm input[type="button"]');
  }

  get newAccountLink(): Locator {
    return this.page.locator('#openAccountResult #newAccountId');
  }

  async availableSourceAccounts(): Promise<number[]> {
    await expect(this.fromAccountSelect.locator('option').first()).toBeAttached();
    const values = await this.fromAccountSelect.locator('option').allInnerTexts();
    return values.map((value) => Number.parseInt(value.trim(), 10));
  }

  /**
   * Opens an account and returns the new account number the page reports.
   *
   * The `<input type="button">` has no default behaviour at all, so a click
   * landing before the ready handler binds does *nothing* and leaves no trace —
   * hence `expectLoaded()`'s wait for the populated select before we get here.
   */
  async openNewAccount(type: Exclude<AccountType, 'LOAN'>, fromAccountId: number): Promise<number> {
    await this.typeSelect.selectOption(TYPE_VALUE[type]);
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.submitButton.click();

    await expect(this.newAccountLink).toBeVisible();
    const text = (await this.newAccountLink.innerText()).trim();
    const accountId = Number.parseInt(text, 10);
    if (!Number.isFinite(accountId)) {
      throw new Error(`Open New Account reported "${text}" instead of an account number`);
    }
    return accountId;
  }
}
