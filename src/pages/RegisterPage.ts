import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import type { Customer } from '../data/types';

/**
 * `/parabank/register.htm`.
 *
 * The inputs carry `id="customer.firstName"`-style ids, which are not valid CSS
 * identifiers without escaping — every locator here goes through the `name`
 * attribute instead, which is identical and readable.
 */
export class RegisterPage extends BasePage {
  protected readonly path = '/parabank/register.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#customerForm');
  }

  field(name: string): Locator {
    return this.page.locator(`#customerForm [name="${name}"]`);
  }

  get submitButton(): Locator {
    return this.page.locator('#customerForm input[type="submit"][value="Register"]');
  }

  /** The per-field validation span, e.g. `#customer.username.errors`. Addressed
   *  by id-suffix because the dots make the id unusable as a plain CSS id. */
  error(fieldName: string): Locator {
    return this.page.locator(`span.error[id="${fieldName}.errors"]`);
  }

  get allErrors(): Locator {
    return this.page.locator('#customerForm span.error');
  }

  /** Confirmation heading: `<h1 class="title">Welcome <username></h1>`. Not the
   *  `#leftPanel` "Welcome First Last" line, which says something different. */
  get confirmationHeading(): Locator {
    return this.page.locator('#rightPanel h1.title');
  }

  get confirmationBody(): Locator {
    return this.page.locator('#rightPanel p').first();
  }

  /** Fills only the keys present, so the validation cases can post a partial form. */
  async fill(customer: Partial<Customer>): Promise<void> {
    const mapping: Array<[keyof Customer, string]> = [
      ['firstName', 'customer.firstName'],
      ['lastName', 'customer.lastName'],
      ['street', 'customer.address.street'],
      ['city', 'customer.address.city'],
      ['state', 'customer.address.state'],
      ['zipCode', 'customer.address.zipCode'],
      ['phoneNumber', 'customer.phoneNumber'],
      ['ssn', 'customer.ssn'],
      ['username', 'customer.username'],
      ['password', 'customer.password'],
    ];
    for (const [key, fieldName] of mapping) {
      const value = customer[key];
      if (value !== undefined) {
        await this.field(fieldName).fill(value);
      }
    }
  }

  async fillRepeatedPassword(value: string): Promise<void> {
    await this.field('repeatedPassword').fill(value);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
