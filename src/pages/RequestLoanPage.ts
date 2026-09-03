import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';

export interface LoanOutcome {
  status: 'Approved' | 'Denied';
  providerName: string;
  /** Present only when approved. */
  newAccountId: number | null;
  /** Present only when denied. */
  denialReason: string | null;
}

/** `/parabank/requestloan.htm`. */
export class RequestLoanPage extends BasePage {
  protected readonly path = '/parabank/requestloan.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#requestLoanForm h1.title');
  }

  get amountInput(): Locator {
    return this.page.locator('#amount');
  }

  get downPaymentInput(): Locator {
    return this.page.locator('#downPayment');
  }

  get fromAccountSelect(): Locator {
    return this.page.locator('#requestLoanForm #fromAccountId');
  }

  get submitButton(): Locator {
    return this.page.locator('#requestLoanForm input[type="button"]');
  }

  get resultPanel(): Locator {
    return this.page.locator('#requestLoanResult');
  }

  get statusCell(): Locator {
    return this.page.locator('#loanStatus');
  }

  get approvedPanel(): Locator {
    return this.page.locator('#loanRequestApproved');
  }

  get deniedPanel(): Locator {
    return this.page.locator('#loanRequestDenied');
  }

  /**
   * Applies and reads the whole outcome in one go, so the caller asserts on a
   * value rather than on the visibility of a `<div>`.
   *
   * The approved and denied panels are two siblings that are shown or hidden;
   * `#newAccountId` is populated *in both cases* (with `null` when denied), so
   * "is the approved panel visible" is the only honest discriminator, and the
   * account id is read only when it is.
   */
  async apply(amount: string, downPayment: string, fromAccountId: number): Promise<LoanOutcome> {
    await this.amountInput.fill(amount);
    await this.downPaymentInput.fill(downPayment);
    await this.fromAccountSelect.selectOption(String(fromAccountId));
    await this.submitButton.click();

    await expect(this.resultPanel).toBeVisible();
    const status = (await this.statusCell.innerText()).trim();
    if (status !== 'Approved' && status !== 'Denied') {
      throw new Error(`Loan Request Processed showed status "${status}"`);
    }

    const providerName = (await this.page.locator('#loanProviderName').innerText()).trim();

    if (status === 'Approved') {
      await expect(this.approvedPanel).toBeVisible();
      const idText = (await this.page.locator('#loanRequestApproved #newAccountId').innerText()).trim();
      const newAccountId = Number.parseInt(idText, 10);
      if (!Number.isFinite(newAccountId)) {
        throw new Error(`An approved loan reported "${idText}" instead of an account number`);
      }
      return { status, providerName, newAccountId, denialReason: null };
    }

    await expect(this.deniedPanel).toBeVisible();
    return {
      status,
      providerName,
      newAccountId: null,
      denialReason: (await this.deniedPanel.locator('p.error').innerText()).trim(),
    };
  }
}
