import type { Locator, Page } from '@playwright/test';

/**
 * A component owns a fragment of the DOM addressed by a root locator, so the
 * same class works on every page that renders the fragment. ParaBank renders its
 * login panel on all six public pages and its account-services menu on all eight
 * private ones.
 */
export abstract class BaseComponent {
  protected constructor(
    protected readonly page: Page,
    readonly root: Locator,
  ) {}

  protected child(selector: string): Locator {
    return this.root.locator(selector);
  }
}
