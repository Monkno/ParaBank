import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';

/** `/parabank/contact.htm` — a plain server-rendered form, no script involved. */
export class ContactPage extends BasePage {
  protected readonly path = '/parabank/contact.htm';

  constructor(page: Page) {
    super(page);
  }

  protected uniqueMarker(): Locator {
    return this.page.locator('#contactForm');
  }

  field(name: 'name' | 'email' | 'phone' | 'message'): Locator {
    return this.page.locator(`#contactForm [name="${name}"]`);
  }

  get submitButton(): Locator {
    return this.page.locator('#contactForm input[type="submit"]');
  }

  get allErrors(): Locator {
    return this.page.locator('#contactForm span.error');
  }

  /**
   * The confirmation replaces the form but keeps the same `<h1>Customer Care</h1>`,
   * so the heading proves nothing. This is the paragraph that names the sender.
   */
  get thankYouMessage(): Locator {
    return this.page.locator('#rightPanel p').first();
  }

  get followUpMessage(): Locator {
    return this.page.locator('#rightPanel p').nth(1);
  }

  async submitEnquiry(fields: Partial<Record<'name' | 'email' | 'phone' | 'message', string>>): Promise<void> {
    for (const [key, value] of Object.entries(fields)) {
      await this.field(key as 'name').fill(value);
    }
    await this.submitButton.click();
  }
}
