import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import type { Customer } from '../data/types';

const FIELD_NAMES: Array<[keyof Customer, string]> = [
  ['firstName', 'customer.firstName'],
  ['lastName', 'customer.lastName'],
  ['street', 'customer.address.street'],
  ['city', 'customer.address.city'],
  ['state', 'customer.address.state'],
  ['zipCode', 'customer.address.zipCode'],
  ['phoneNumber', 'customer.phoneNumber'],
];

/**
 * `/parabank/updateprofile.htm`.
 *
 * The form is populated by AJAX from `services_proxy/bank/customers/{id}`, so
 * the identity marker has to be a *filled* field: the empty inputs are in the
 * DOM from the first byte, and typing into one before the fetch lands means the
 * fetch overwrites what was typed.
 *
 * This page also inlines the signed-in customer's username and password into the
 * JSP as literal JavaScript (defect D05). Nothing here reads them; the finding is
 * asserted once, in `tests/auth/lookup.spec.ts`.
 */
export class UpdateProfilePage extends BasePage {
  protected readonly path = '/parabank/updateprofile.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#updateProfileForm h1.title');
  }

  override async expectLoaded(): Promise<void> {
    await super.expectLoaded();
    // The AJAX has landed once the first name is no longer blank. Every
    // customer this suite creates has a non-empty first name by construction.
    await expect(this.field('firstName')).not.toHaveValue('');
  }

  field(key: keyof Customer): Locator {
    const entry = FIELD_NAMES.find(([name]) => name === key);
    if (!entry) {
      throw new Error(`Update Profile has no field for "${String(key)}"`);
    }
    return this.page.locator(`#updateProfileForm [name="${entry[1]}"]`);
  }

  get submitButton(): Locator {
    return this.page.locator('#updateProfileForm input[type="button"]');
  }

  error(key: 'firstName' | 'lastName' | 'street' | 'city' | 'state' | 'zipCode'): Locator {
    return this.page.locator(`#${key}-error`);
  }

  get visibleErrors(): Locator {
    return this.page.locator('#updateProfileForm span.error:visible');
  }

  get resultPanel(): Locator {
    return this.page.locator('#updateProfileResult');
  }

  get errorPanel(): Locator {
    return this.page.locator('#updateProfileError');
  }

  /** Reads back every editable field, so a test can compare the whole profile
   *  field by field instead of spot-checking one. */
  async readProfile(): Promise<Record<string, string>> {
    const entries = await Promise.all(
      FIELD_NAMES.map(async ([key]) => [key, await this.field(key).inputValue()] as const),
    );
    return Object.fromEntries(entries);
  }

  async fill(values: Partial<Customer>): Promise<void> {
    for (const [key] of FIELD_NAMES) {
      const value = values[key];
      if (value !== undefined) {
        await this.field(key).fill(value);
      }
    }
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
