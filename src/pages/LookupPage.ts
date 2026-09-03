import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import type { Customer } from '../data/types';

/**
 * `/parabank/lookup.htm` — "Forgot login info?".
 *
 * The application answers a match by printing the username *and the password in
 * clear text* and opening a session (defect D02). This page object reads that
 * back; it does not endorse it.
 */
export class LookupPage extends BasePage {
  protected readonly path = '/parabank/lookup.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#lookupForm');
  }

  field(name: string): Locator {
    return this.page.locator(`#lookupForm [name="${name}"]`);
  }

  get submitButton(): Locator {
    return this.page.locator('#lookupForm input[type="submit"]');
  }

  get allErrors(): Locator {
    return this.page.locator('#lookupForm span.error');
  }

  /** `<p><b>Username</b>: qa1234<br/><b>Password</b>: Passw0rd1</p>` */
  get credentialsParagraph(): Locator {
    return this.page.locator('#rightPanel p').nth(1);
  }

  get statusMessage(): Locator {
    return this.page.locator('#rightPanel p').first();
  }

  async lookUp(customer: Partial<Customer>): Promise<void> {
    const mapping: Array<[keyof Customer, string]> = [
      ['firstName', 'firstName'],
      ['lastName', 'lastName'],
      ['street', 'address.street'],
      ['city', 'address.city'],
      ['state', 'address.state'],
      ['zipCode', 'address.zipCode'],
      ['ssn', 'ssn'],
    ];
    for (const [key, fieldName] of mapping) {
      const value = customer[key];
      if (value !== undefined) {
        await this.field(fieldName).fill(value);
      }
    }
    await this.submitButton.click();
  }
}
