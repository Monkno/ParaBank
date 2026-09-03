import { test, expect } from '../../src/fixtures/test';
import { dollarsToCents } from '../../src/support/money';

/**
 * The REST surface. ParaBank publishes the same JAX-RS resource twice:
 * `/parabank/services/bank/...` with no authentication at all, and
 * `/parabank/services_proxy/bank/...` behind the session. Everything in this
 * file is read-only; the WADL also advertises `cleanDB`, `initializeDB` and
 * `setParameter/{name}/{value}` on the unauthenticated mount, and the suite
 * asserts that they are advertised without ever calling them.
 */
test.describe('REST API @api', () => {
  test('TC28 — the API reports the same account as the UI', async ({
    signedIn,
    activityPage,
    publicBankApi,
    bankApi,
  }) => {
    await activityPage.openFor(signedIn.primaryAccountId);

    const shownId = (await activityPage.accountNumber.innerText()).trim();
    const shownType = (await activityPage.accountType.innerText()).trim();
    const shownBalance = await activityPage.readBalance();

    const fromApi = await publicBankApi.getAccount(signedIn.primaryAccountId);

    expect(Number.parseInt(shownId, 10), 'account id').toBe(fromApi.id);
    expect(shownType, 'account type').toBe(fromApi.type);
    expect(shownBalance, 'balance').toBe(dollarsToCents(fromApi.balance));
    expect(fromApi.customerId, 'the account belongs to the customer this test registered').toBe(
      signedIn.customerId,
    );

    // The two mounts agree with each other as well as with the page.
    expect(await bankApi.getAccount(signedIn.primaryAccountId)).toEqual(fromApi);
  });

  /**
   * D01 — the unauthenticated mount.
   *
   * `services/bank` answers account balances, transaction history and full
   * customer records, including the SSN, to a caller with no session and no
   * credentials. Chained with the "Forgot login info?" lookup (D02), which
   * matches on name + address + SSN and replies with the password, that is a
   * complete account takeover starting from an account number alone.
   *
   * Every assertion below runs against a customer this test created, so the
   * finding is demonstrated without reading anybody else's data.
   */
  test('D01 — account, transaction and customer data are readable without a session', async ({
    signedIn,
    publicBankApi,
    request,
  }) => {
    // The `request` fixture carries no cookies. The same resource behind the
    // proxy refuses it, which is what makes the open mount a defect rather than
    // a design choice.
    expect(
      (await request.get(`/parabank/services_proxy/bank/accounts/${signedIn.primaryAccountId}`)).status(),
      'the authenticated mount requires a session',
    ).toBe(401);

    expect(
      await publicBankApi.statusOf(`/accounts/${signedIn.primaryAccountId}`),
      'the open mount does not',
    ).toBe(200);

    const account = await publicBankApi.getAccount(signedIn.primaryAccountId);
    expect(account.customerId, 'a balance and its owner are disclosed anonymously').toBe(
      signedIn.customerId,
    );

    const customer = await publicBankApi.getCustomer(signedIn.customerId);
    expect(customer.ssn, 'the SSN is disclosed anonymously').toBe(signedIn.customer.ssn);
    expect(customer.address.street, 'and the home address with it').toBe(signedIn.customer.street);

    // Transaction history too, on the same terms. This customer has made no
    // transactions, so the empty array is the correct disclosure — the finding
    // is the 200, asserted above, not the contents.
    expect(await publicBankApi.listTransactions(signedIn.primaryAccountId)).toEqual([]);
  });

  /**
   * D06 — the destructive operations are on the open mount too.
   *
   * The WADL is read and the dangerous resources are asserted to be *declared*.
   * None of them is invoked: `cleanDB` drops the database and `setParameter`
   * rewrites global settings such as `minimumBalance`, and this suite shares the
   * instance with everyone else using the demo.
   */
  test('D06 — the unauthenticated service advertises destructive operations', async ({ request }) => {
    const response = await request.get('/parabank/services/bank?_wadl&_type=xml');
    expect(response.status(), 'GET the WADL').toBe(200);

    const wadl = await response.text();
    const declared = [...wadl.matchAll(/path="([^"]+)"/g)].map((match) => match[1]);
    expect(declared.length, 'the WADL declares resources').toBeGreaterThan(0);

    for (const path of [
      'cleanDB',
      'initializeDB',
      'setParameter/{name}/{value}',
      'login/{username}/{password}',
    ]) {
      expect(declared, `unauthenticated resource "${path}"`).toContain(path);
    }
  });
});
