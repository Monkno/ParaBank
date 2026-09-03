import { test, expect } from '../../src/fixtures/test';
import { buildCustomer } from '../../src/data/factories';
import { dollarsToCents } from '../../src/support/money';

/**
 * Registration. Every case here creates its own customer with a username, a
 * name and an SSN unique to the worker and the millisecond — the shared demo
 * has thousands of customers in it and a fixed fixture would collide.
 */
test.describe('Registration @auth', () => {
  test('TC05 — a new customer is created, signed in, and stored as it was typed', async ({
    customerFlow,
    customerData,
    overviewPage,
    bankApi,
  }) => {
    const session = await customerFlow.signUp(customerData);

    // On screen.
    await expect(overviewPage.menu.welcomeLine).toHaveText(
      `Welcome ${customerData.firstName} ${customerData.lastName}`,
    );

    // In the backend, field by field against what the form was given. Nothing
    // here is a literal, so the case survives any change to the data factory.
    const stored = await bankApi.getCustomer(session.customerId);
    expect(stored.firstName, 'stored first name').toBe(customerData.firstName);
    expect(stored.lastName, 'stored last name').toBe(customerData.lastName);
    expect(stored.address.street, 'stored street').toBe(customerData.street);
    expect(stored.address.city, 'stored city').toBe(customerData.city);
    expect(stored.address.state, 'stored state').toBe(customerData.state);
    expect(stored.address.zipCode, 'stored zip code').toBe(customerData.zipCode);
    expect(stored.phoneNumber, 'stored phone number').toBe(customerData.phoneNumber);
    expect(stored.ssn, 'stored SSN').toBe(customerData.ssn);

    // Registration opens exactly one CHECKING account, and the balance the
    // overview renders is the balance the backend holds. The opening amount is
    // a server-side parameter that anyone can change through admin.htm, so it
    // is read, never asserted against a literal.
    const accounts = await bankApi.listAccounts(session.customerId);
    expect(accounts, 'accounts created at registration').toHaveLength(1);
    expect(accounts[0].id).toBe(session.primaryAccountId);
    expect(accounts[0].type).toBe('CHECKING');

    const rows = await overviewPage.readAccountRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBe(session.primaryAccountId);
    expect(rows[0].balance, 'overview balance vs API balance').toBe(dollarsToCents(accounts[0].balance));
  });

  test('TC06 — a duplicate username is rejected and the original customer is untouched', async ({
    customerFlow,
    customerData,
    session,
    registerPage,
    bankApi,
  }) => {
    const original = await customerFlow.signUp(customerData);
    await session.signOut();

    // Same username, everything else different — so the only thing that can
    // trigger the rejection is the username.
    const impostor = buildCustomer({ username: customerData.username });
    await registerPage.open();
    await registerPage.fill(impostor);
    await registerPage.fillRepeatedPassword(impostor.password);
    await registerPage.submit();

    await expect(registerPage.error('customer.username')).toHaveText('This username already exists.');
    await expect(registerPage.allErrors, 'only the username is at fault').toHaveCount(1);
    // Still on the form, not on the "Welcome <username>" confirmation.
    await expect(registerPage.confirmationHeading).toHaveText('Signing up is easy!');

    // The original account still resolves to the original person: the rejected
    // registration neither created a shadow customer nor overwrote this one.
    await session.signIn(customerData.username, customerData.password);
    await session.expectSignedIn(customerData);

    const stored = await bankApi.getCustomer(original.customerId);
    expect(stored.firstName, 'the original customer survived the duplicate attempt').toBe(
      customerData.firstName,
    );
    expect(stored.ssn, 'the impostor did not overwrite the SSN').toBe(customerData.ssn);
  });

  /**
   * Every required field reports itself. Asserted exhaustively with
   * `toHaveText([...])`, which fails if a message is missing *or* extra.
   *
   * Phone # is deliberately absent from the list: ParaBank does not require it,
   * although the field sits among ten that are all mandatory. Following the
   * application rather than the case text — see STRATEGY.md, D10.
   */
  test('TC07 — an empty registration form reports every required field', async ({ registerPage }) => {
    await registerPage.open();
    await registerPage.submit();

    await expect(registerPage.allErrors).toHaveText([
      'First name is required.',
      'Last name is required.',
      'Address is required.',
      'City is required.',
      'State is required.',
      'Zip Code is required.',
      'Social Security Number is required.',
      'Username is required.',
      'Password is required.',
      'Password confirmation is required.',
    ]);

    await expect(registerPage.error('customer.phoneNumber'), 'Phone # is not required (D10)').toHaveCount(0);
  });

  });
