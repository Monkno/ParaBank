import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { parseUsd, type Cents } from '../support/money';

export interface FoundTransaction {
  date: string;
  description: string;
  debit: Cents | null;
  credit: Cents | null;
}

/**
 * `/parabank/findtrans.htm`.
 *
 * All four search buttons are `type="submit"` inside `<form id="transactionForm">`,
 * and the only thing stopping a native form submission is a `preventDefault()`
 * inside `$(document).ready`. Clicking one before that handler is bound navigates
 * to `findtrans.htm?` and silently performs no search — the exact failure
 * auto-waiting cannot see. `BasePage.waitForHandlersBound()` is the guard.
 */
export class FindTransactionsPage extends BasePage {
  protected readonly path = '/parabank/findtrans.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#formContainer h1.title');
  }

  get accountSelect(): Locator {
    return this.page.locator('#accountId');
  }

  get resultRows(): Locator {
    return this.page.locator('#transactionBody tr');
  }

  error(which: 'transactionId' | 'transactionDate' | 'dateRange' | 'amount'): Locator {
    return this.page.locator(`#${which}Error`);
  }

  private async run(fill: () => Promise<void>, buttonId: string, accountId: number): Promise<void> {
    await this.accountSelect.selectOption(String(accountId));
    await fill();
    await this.page.locator(`#${buttonId}`).click();
    // The form is hidden and the result container shown by the same handler, in
    // both the success and the 404 path — so this is a genuine outcome signal,
    // not merely "an element exists".
    await expect(this.page.locator('#resultContainer')).toBeVisible();
  }

  async findById(accountId: number, transactionId: number): Promise<FoundTransaction[]> {
    await this.run(() => this.page.locator('#transactionId').fill(String(transactionId)), 'findById', accountId);
    return this.readResults();
  }

  async findByDate(accountId: number, date: string): Promise<FoundTransaction[]> {
    await this.run(() => this.page.locator('#transactionDate').fill(date), 'findByDate', accountId);
    return this.readResults();
  }

  async findByDateRange(accountId: number, fromDate: string, toDate: string): Promise<FoundTransaction[]> {
    await this.run(
      async () => {
        await this.page.locator('#fromDate').fill(fromDate);
        await this.page.locator('#toDate').fill(toDate);
      },
      'findByDateRange',
      accountId,
    );
    return this.readResults();
  }

  async findByAmount(accountId: number, amount: string): Promise<FoundTransaction[]> {
    await this.run(() => this.page.locator('#amount').fill(amount), 'findByAmount', accountId);
    return this.readResults();
  }

  /**
   * Reads whatever the result table holds. Callers that expect matches must
   * assert on the returned length themselves — this method must be able to
   * return `[]` because "no match" is a legitimate outcome the negative cases
   * assert on.
   */
  private async readResults(): Promise<FoundTransaction[]> {
    const rows = await this.resultRows.all();
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
