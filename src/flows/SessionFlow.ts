import { expect, type Page } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { OverviewPage } from '../pages/OverviewPage';
import { AccountServicesMenu } from '../components/AccountServicesMenu';
import type { Customer } from '../data/types';

/**
 * Signing in and out, and asserting which of the two states the browser is in.
 *
 * Kept apart from `CustomerFlow` because the divergence between the cases is
 * here, not in registration: TC09/TC12/TC13/TC14 all need an account that
 * exists and a browser that is *signed out*, while TC15-TC27 need the opposite.
 * Registration leaves you signed in, so "signed out" is a real step and gets a
 * real method rather than a comment in seven tests.
 */
export class SessionFlow {
  private readonly homePage: HomePage;
  private readonly overviewPage: OverviewPage;
  private readonly menu: AccountServicesMenu;

  constructor(private readonly page: Page) {
    this.homePage = new HomePage(page);
    this.overviewPage = new OverviewPage(page);
    this.menu = new AccountServicesMenu(page);
  }

  async signIn(username: string, password: string): Promise<void> {
    await this.homePage.open();
    await this.homePage.login.signIn(username, password);
  }

  /** Uses the menu link, because that is the only logout affordance a user has. */
  async signOut(): Promise<void> {
    await this.menu.logOutLink.click();
    await this.expectSignedOut();
  }

  /** Navigates to the private area rather than assuming the current page is
   *  already it: registration, login *and* the "Forgot login info?" lookup all
   *  open a session, and they land on three different pages. */
  async expectSignedIn(customer: Customer): Promise<void> {
    await this.overviewPage.open();
    await expect(this.menu.welcomeLine).toHaveText(`Welcome ${customer.firstName} ${customer.lastName}`);
  }

  /** Signed out means two things at once: the login panel is back, and the
   *  private menu is gone. Asserting only the first would pass on any page that
   *  merely happens to render a login form. */
  async expectSignedOut(): Promise<void> {
    await expect(this.homePage.login.submitButton).toBeVisible();
    await expect(this.menu.logOutLink).toHaveCount(0);
  }

  /**
   * Asserts that a login attempt was *refused*: the error message shown, and no
   * session opened. The message names defect D17 because that is the one thing
   * that turns this assertion red without the test being wrong — when the shared
   * demo falls into its intermittent authentication-bypass state, a rejected
   * login is answered with Accounts Overview instead of the error, and this
   * points a reader straight at the cause instead of a locator timeout.
   */
  async expectLoginRejected(): Promise<void> {
    await expect(
      this.menu.logOutLink,
      'a bad login opened a session — the server is in the D17 authentication-bypass state',
    ).toHaveCount(0);
    await expect(this.page.locator('#rightPanel p.error')).toHaveText(
      'The username and password could not be verified.',
    );
    await expect(this.homePage.login.submitButton).toBeVisible();
  }
}
