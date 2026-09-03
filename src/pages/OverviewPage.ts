import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { AccountServicesMenu } from '../components/AccountServicesMenu';
import { parseUsd, type Cents } from '../support/money';

export interface OverviewRow {
  accountId: number;
  balance: Cents;
  available: Cents;
}

/**
 * `/parabank/overview.htm`.
 *
 * The `<tbody>` ships empty and is filled by an inline `$.ajax` against
 * `services_proxy/bank/customers/{id}/accounts`, so the identity marker is a
 * rendered row, not the table.
 */
export class OverviewPage extends BasePage {
  protected readonly path = '/parabank/overview.htm';
  readonly menu: AccountServicesMenu;

  constructor(page: Page) {
    super(page);
    this.menu = new AccountServicesMenu(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#accountTable tbody tr').first();
  }

  get heading(): Locator {
    return this.page.locator('#showOverview h1.title');
  }

  private get accountRows(): Locator {
    // Every row but the trailing Total row, which has no account link.
    return this.page.locator('#accountTable tbody tr').filter({ has: this.page.locator('td a[href*="activity.htm"]') });
  }

  accountLink(accountId: number): Locator {
    return this.page.locator(`#accountTable tbody a[href="activity.htm?id=${accountId}"]`);
  }

  /**
   * Every account row, parsed into numbers.
   *
   * The first-row wait is load-bearing, not decoration: without it this returns
   * `[]` the instant the AJAX is still in flight, and every "for each account"
   * assertion downstream would pass against nothing.
   */
  async readAccountRows(): Promise<OverviewRow[]> {
    await expect(this.uniqueMarker()).toBeVisible();
    const rows = await this.accountRows.all();
    return Promise.all(
      rows.map(async (row) => {
        const cells = await row.locator('td').allInnerTexts();
        return {
          accountId: Number.parseInt(cells[0].trim(), 10),
          balance: parseUsd(cells[1]),
          available: parseUsd(cells[2]),
        };
      }),
    );
  }

  /** The `Total` row the page computes client-side by summing the balances. */
  async readTotal(): Promise<Cents> {
    const totalRow = this.page
      .locator('#accountTable tbody tr')
      .filter({ hasText: 'Total' })
      .last();
    await expect(totalRow).toBeVisible();
    const cells = await totalRow.locator('td').allInnerTexts();
    return parseUsd(cells[1]);
  }
}
