import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { LoginPanel } from '../components/LoginPanel';

/** `/parabank/index.htm` — the public landing page. */
export class HomePage extends BasePage {
  protected readonly path = '/parabank/index.htm';
  readonly login: LoginPanel;

  constructor(page: Page) {
    super(page);
    this.login = new LoginPanel(page);
  }

  /** The news list is the only block unique to the home page; the login panel,
   *  header and footer are on every public page. */
  protected uniqueMarker(): Locator {
    return this.page.locator('#rightPanel ul.events');
  }

  get newsHeadlines(): Locator {
    return this.page.locator('#rightPanel ul.events li:not(.captionthree) a');
  }

  get atmServices(): Locator {
    return this.page.locator('#rightPanel ul.services li:not(.captionone)');
  }

  get onlineServices(): Locator {
    return this.page.locator('#rightPanel ul.servicestwo li:not(.captiontwo)');
  }

  /** The footer is the only nav that carries all five internal destinations, so
   *  TC02 walks it; the header duplicates three of them and would make every
   *  by-name locator ambiguous. */
  footerLink(label: string): Locator {
    return this.page.locator('#footerPanel').getByRole('link', { name: label, exact: true });
  }

  /**
   * The unauthenticated administration link in the banner.
   *
   * The suite asserts that it is there and never follows it. `admin.htm` needs
   * no credentials and offers `action=CLEAN` (drop the database), `action=INIT`
   * and a `shutdown` control, any of which would break the shared demo for
   * everyone using it. See STRATEGY.md, D06.
   */
  get adminLink(): Locator {
    return this.page.locator('#headerPanel ul.leftmenu a[href*="admin.htm"]');
  }
}
