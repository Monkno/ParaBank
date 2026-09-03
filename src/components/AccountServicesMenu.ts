import { type Locator, type Page } from '@playwright/test';
import { BaseComponent } from '../core/BaseComponent';

/**
 * The left column of the private area: the "Welcome <First> <Last>" line and the
 * *Account Services* menu. Rendered on all eight signed-in pages, which makes it
 * both the navigation and the cheapest "am I still signed in?" probe available.
 */
export class AccountServicesMenu extends BaseComponent {
  constructor(page: Page) {
    super(page, page.locator('#leftPanel'));
  }

  /** `<p class="smallText"><b>Welcome</b> Ada Lovelace</p>` */
  get welcomeLine(): Locator {
    return this.child('p.smallText');
  }

  get logOutLink(): Locator {
    return this.child('a[href*="logout.htm"]');
  }

  link(label: string): Locator {
    return this.root.getByRole('link', { name: label, exact: true });
  }
}
