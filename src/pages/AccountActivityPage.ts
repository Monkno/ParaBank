import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { parseUsd, type Cents } from '../support/money';

export interface ActivityRow {
  date: string;
  description: string;
  debit: Cents | null;
  credit: Cents | null;
}

/**
 * `/parabank/activity.htm?id=<accountId>` — the account detail and its
 * transaction list, both filled by AJAX.
 *
 * Note this page is *not* protected server-side: it answers HTTP 200 without a
 * session (unlike overview/transfer/billpay, which answer 500). It leaks
 * nothing, because the data comes from the authenticated proxy, but the
 * inconsistency is recorded as D04.
 */
export class AccountActivityPage extends BasePage {
  /** The only page in the suite whose path carries a parameter. It is a plain
   *  field rather than a getter: with ES2022 class fields the base class defines
   *  `path` on the instance, and defining over an accessor throws. */
  protected path = '/parabank/activity.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    // `#accountDetails` starts `display:none` and is shown by the ready handler,
    // so its visibility is a genuine "the script ran" signal. The account number
    // cell then confirms the AJAX landed.
    return this.page.locator('#accountDetails #accountId');
  }

  async openFor(accountId: number): Promise<void> {
    this.path = `/parabank/activity.htm?id=${accountId}`;
    await this.open();
    await expect(this.accountNumber).not.toBeEmpty();
  }

  /** Navigates to an account's detail page without asserting the status, for
   *  the authorization cases where the status is the observation. */
  async openRawFor(accountId: number): Promise<number> {
    this.path = `/parabank/activity.htm?id=${accountId}`;
    return this.openRaw();
  }

  /** Adopts an already-open activity page, e.g. after clicking a link in the
   *  overview, so the same reader methods work either way. */
  async adopt(accountId: number): Promise<void> {
    this.path = `/parabank/activity.htm?id=${accountId}`;
    await this.expectLoaded();
    await expect(this.accountNumber).not.toBeEmpty();
  }

  get accountNumber(): Locator {
    return this.page.locator('#accountId');
  }

  get accountType(): Locator {
    return this.page.locator('#accountType');
  }

  get balance(): Locator {
    return this.page.locator('#balance');
  }

  get availableBalance(): Locator {
    return this.page.locator('#availableBalance');
  }

  get noTransactionsMessage(): Locator {
    return this.page.locator('#noTransactions');
  }

  get transactionRows(): Locator {
    return this.page.locator('#transactionTable tbody tr');
  }

  async readBalance(): Promise<Cents> {
    return parseUsd((await this.balance.innerText()).trim());
  }

  /** Waits for at least one row before reading, so an empty list is a timeout
   *  with a message rather than a vacuously passing loop. */
  async readTransactions(): Promise<ActivityRow[]> {
    await expect(this.transactionRows.first()).toBeVisible();
    const rows = await this.transactionRows.all();
    return Promise.all(
      rows.map(async (row) => {
        const cells = await row.locator('td').allInnerTexts();
        const debit = cells[2].trim();
        const credit = cells[3].trim();
        return {
          date: cells[0].trim(),
          description: cells[1].trim(),
          debit: debit === '' ? null : parseUsd(debit),
          credit: credit === '' ? null : parseUsd(credit),
        };
      }),
    );
  }
}
