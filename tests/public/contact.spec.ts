import { test, expect } from '../../src/fixtures/test';
import { uniqueTag } from '../../src/data/factories';

test.describe('Contact Us @public', () => {
  test('TC03 — a completed enquiry is acknowledged by name', async ({ contactPage, page }) => {
    // Tagged so a human reading the shared demo's mailbox can tell this apart
    // from a real enquiry.
    const tag = uniqueTag();
    const enquiry = {
      name: `Qa Suite ${tag}`,
      email: `qa.suite+${tag}@example.com`,
      phone: '5125550100',
      message: `Automated end-to-end check ${tag}. Please ignore.`,
    };

    await contactPage.open();
    await contactPage.submitEnquiry(enquiry);

    // The heading stays "Customer Care" on both the form and the confirmation,
    // so it proves nothing. The acknowledgement echoes back the name that was
    // typed, which is the only thing that distinguishes the two states.
    await expect(contactPage.thankYouMessage).toHaveText(`Thank you ${enquiry.name}`);
    await expect(contactPage.followUpMessage).toHaveText(
      'A Customer Care Representative will be contacting you.',
    );
    // The form is gone, so the enquiry was consumed rather than re-offered.
    await expect(page.locator('#contactForm')).toHaveCount(0);
  });

  test('TC04 — an empty enquiry reports every required field and is not sent', async ({
    contactPage,
    page,
  }) => {
    await contactPage.open();
    await contactPage.submitEnquiry({ name: '', email: '', phone: '', message: '' });

    // Exact, not "contains": a page that reported one error out of four would
    // pass a containment check and is still broken.
    await expect(contactPage.allErrors).toHaveText([
      'Name is required.',
      'Email is required.',
      'Phone is required.',
      'Message is required.',
    ]);

    // Nothing was sent: the form is still on screen and the acknowledgement,
    // which would name the sender, never appeared.
    await expect(page.locator('#contactForm')).toHaveCount(1);
    await expect(page.locator('#rightPanel')).not.toContainText('Thank you');
  });

  /**
   * A gap the published cases do not cover: ParaBank's contact form checks only
   * that the four fields are non-blank. It accepts an address that is not an
   * address and a phone number that is a word, and acknowledges both. Asserted
   * as observed behaviour (defect D09), so a future validation fix is noticed.
   */
  test('D09 — the contact form accepts a malformed email and a non-numeric phone', async ({
    contactPage,
  }) => {
    const name = `Qa Suite ${uniqueTag()}`;
    await contactPage.open();
    await contactPage.submitEnquiry({
      name,
      email: 'not-an-email',
      phone: 'not-a-phone',
      message: 'Automated validation probe. Please ignore.',
    });

    await expect(contactPage.thankYouMessage).toHaveText(`Thank you ${name}`);
  });
});
