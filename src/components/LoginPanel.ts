import { type Locator, type Page } from '@playwright/test';
import { BaseComponent } from '../core/BaseComponent';

/**
 * The *Customer Login* panel in the left column. ParaBank renders it identically
 * on all six public pages (index, register, lookup, about, services, contact),
 * so the login and register entry points are addressable from wherever a test
 * happens to be.
 *
 * The form is a plain server-side POST to `login.htm` — no script binding, so
 * nothing here needs `waitForHandlersBound`.
 */
export class LoginPanel extends BaseComponent {
  constructor(page: Page) {
    super(page, page.locator('#loginPanel'));
  }

  get usernameInput(): Locator {
    return this.child('input[name="username"]');
  }

  get passwordInput(): Locator {
    return this.child('input[name="password"]');
  }

  get submitButton(): Locator {
    return this.child('input[type="submit"][value="Log In"]');
  }

  get registerLink(): Locator {
    return this.child('a[href*="register.htm"]');
  }

  get forgotLoginLink(): Locator {
    return this.child('a[href*="lookup.htm"]');
  }

  /** Fills and submits. Empty strings are filled deliberately — TC11 needs the
   *  form posted with both fields blank, not skipped. */
  async signIn(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
