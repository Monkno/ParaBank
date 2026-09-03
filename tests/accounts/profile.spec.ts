import { test, expect } from '../../src/fixtures/test';
import { buildCustomer } from '../../src/data/factories';

test.describe('Update contact info @accounts', () => {
  test('TC26 — an updated profile persists and matches the backend record', async ({
    signedIn,
    updateProfilePage,
    bankApi,
  }) => {
    await updateProfilePage.open();

    // The form arrives pre-filled from the backend. Asserted field by field
    // against what registration was given, so this doubles as proof that the
    // read path is correct before anything is written.
    expect(await updateProfilePage.readProfile(), 'the form loads the registered profile').toEqual({
      firstName: signedIn.customer.firstName,
      lastName: signedIn.customer.lastName,
      street: signedIn.customer.street,
      city: signedIn.customer.city,
      state: signedIn.customer.state,
      zipCode: signedIn.customer.zipCode,
      phoneNumber: signedIn.customer.phoneNumber,
    });

    // A completely different person, generated the same way the original was.
    const updated = buildCustomer();
    await updateProfilePage.fill(updated);
    await updateProfilePage.submit();

    await expect(updateProfilePage.resultPanel).toBeVisible();
    await expect(updateProfilePage.resultPanel).toContainText(
      'Your updated address and phone number have been added to the system.',
    );
    await expect(updateProfilePage.errorPanel).toBeHidden();

    // Persistence, from a fresh load rather than from the fields still on screen.
    await updateProfilePage.open();
    expect(await updateProfilePage.readProfile(), 'the new profile survived a reload').toEqual({
      firstName: updated.firstName,
      lastName: updated.lastName,
      street: updated.street,
      city: updated.city,
      state: updated.state,
      zipCode: updated.zipCode,
      phoneNumber: updated.phoneNumber,
    });

    // And in the backend, field by field.
    const stored = await bankApi.getCustomer(signedIn.customerId);
    expect(stored.firstName).toBe(updated.firstName);
    expect(stored.lastName).toBe(updated.lastName);
    expect(stored.address.street).toBe(updated.street);
    expect(stored.address.city).toBe(updated.city);
    expect(stored.address.state).toBe(updated.state);
    expect(stored.address.zipCode).toBe(updated.zipCode);
    expect(stored.phoneNumber).toBe(updated.phoneNumber);
    // The SSN is not on this form and must survive an update untouched.
    expect(stored.ssn, 'the SSN is not editable here and must not change').toBe(signedIn.customer.ssn);
  });

  test('TC27 — clearing the required fields is rejected and leaves the profile intact', async ({
    signedIn,
    updateProfilePage,
    bankApi,
  }) => {
    await updateProfilePage.open();
    await updateProfilePage.fill({
      firstName: '',
      lastName: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
    });
    await updateProfilePage.submit();

    await expect(updateProfilePage.visibleErrors).toHaveText([
      'First name is required.',
      'Last name is required.',
      'Address is required.',
      'City is required.',
      'State is required.',
      'Zip Code is required.',
    ]);
    await expect(updateProfilePage.resultPanel).toBeHidden();

    // Nothing was written: the stored record still holds every original value.
    const stored = await bankApi.getCustomer(signedIn.customerId);
    expect(stored.firstName).toBe(signedIn.customer.firstName);
    expect(stored.lastName).toBe(signedIn.customer.lastName);
    expect(stored.address.street).toBe(signedIn.customer.street);
    expect(stored.address.city).toBe(signedIn.customer.city);
    expect(stored.address.state).toBe(signedIn.customer.state);
    expect(stored.address.zipCode).toBe(signedIn.customer.zipCode);
    expect(stored.phoneNumber).toBe(signedIn.customer.phoneNumber);

    // And the form still offers the original data after a reload.
    await updateProfilePage.open();
    expect(await updateProfilePage.readProfile()).toEqual({
      firstName: signedIn.customer.firstName,
      lastName: signedIn.customer.lastName,
      street: signedIn.customer.street,
      city: signedIn.customer.city,
      state: signedIn.customer.state,
      zipCode: signedIn.customer.zipCode,
      phoneNumber: signedIn.customer.phoneNumber,
    });
  });

  /**
   * Phone # is the one field on this form with no validation, matching its
   * absence from the registration form's required set (D10). Clearing it alone
   * is accepted and the empty value is stored — asserted so the inconsistency is
   * visible rather than assumed.
   */
  test('D10 — the phone number is optional on Update Contact Info', async ({
    signedIn,
    updateProfilePage,
    bankApi,
  }) => {
    await updateProfilePage.open();
    await updateProfilePage.fill({ phoneNumber: '' });
    await updateProfilePage.submit();

    await expect(updateProfilePage.resultPanel).toBeVisible();
    await expect(updateProfilePage.visibleErrors).toHaveCount(0);

    const stored = await bankApi.getCustomer(signedIn.customerId);
    expect(stored.phoneNumber ?? '', 'the phone number was cleared without complaint').toBe('');
  });
});
