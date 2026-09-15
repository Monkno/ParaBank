# ParaBank — E2E suite (Playwright + TypeScript)

End-to-end suite against Parasoft's demo online banking application,
**https://parabank.parasoft.com/parabank/index.htm**.

The suite combines browser/API scenarios with focused, parameterised unit
coverage for the shared money and date helpers. The current inventory is always
available with `npx playwright test --list`.

The cases live in [`TEST_CASES.md`](./TEST_CASES.md); the design decisions and the
defects found in the application, in [`STRATEGY.md`](./STRATEGY.md).

---

## Install and run

```bash
node --version # Node.js 24 or newer
npm ci
npx playwright install --with-deps chromium
cp .env.example .env
npm test
```

Useful commands:

| Command | What it does |
|---|---|
| `npm test` | Unit tests, then every browser lane |
| `npm run test:full` | Every browser lane, including pinned known defects |
| `npm run test:e2e` | Functional browser tests only |
| `npm run test:smoke` | Two read-only public smoke checks |
| `npm run test:read-only` | Safe functional reads; one retry in CI |
| `npm run test:mutating` | Functional tests that write; never retried |
| `npm run test:known-defects` | Defect-pinning lane; never retried |
| `npm run test:headed` | Every browser lane with a visible browser |
| `npm run test:unit` | All hermetic unit tests, always with zero retries |
| `npm run audit` | Fails on high/critical dependency advisories |
| `npm run report` | Opens the last HTML report |
| `npm run typecheck` | Typecheck |

### Why the default is 1 worker

Measured against the only available target. Four workers trip Cloudflare quickly;
two have completed a run but have also tripped the limit during a later full run.
One worker is slower but is the responsible default for the shared demo. The config
rejects values above 2 and stops the run after its first failure to avoid turning an
outage or rate limit into dozens of requests.

### Configuration

`.env.example` documents the variables. The suite performs a lightweight check
of both `index.htm` and `register.htm` before opening browsers; a rate limit or
unhealthy demo therefore stops the run before it creates partial test data.

`RUN_ID` is supplied by CI and included in generated usernames. On failure, the
report also contains the run/worker/retry metadata, the safe customer identity
(never the password), failed requests, HTTP errors and browser console errors.

---

## TC → test mapping

| TC | File | Test |
|---|---|---|
| TC01 | `tests/public/site.spec.ts` | the home page carries the login panel, the news list and the service lists |
| TC02 | `tests/public/site.spec.ts` | every footer destination answers 200 · About Us and Site Map render their documented content |
| TC03 | `tests/public/contact.spec.ts` | a completed enquiry is acknowledged by name |
| TC04 | `tests/public/contact.spec.ts` | an empty enquiry reports every required field and is not sent |
| TC05 | `tests/auth/registration.spec.ts` | a new customer is created, signed in, and stored as it was typed |
| TC06 | `tests/auth/registration.spec.ts` | a duplicate username is rejected and the original customer is untouched |
| TC07 | `tests/auth/registration.spec.ts` | an empty registration form reports every required field |
| TC09 | `tests/auth/login.spec.ts` | valid credentials open the private area |
| TC11 | `tests/auth/login.spec.ts` | an empty login form asks for both fields |
| TC12 | `tests/auth/login.spec.ts` | logging out ends the session and re-protects the private area |
| TC13 | `tests/auth/login.spec.ts` | private pages are refused without a session |
| TC14 | `tests/auth/lookup.spec.ts` | matching details return credentials · wrong SSN is not enough · empty lookup reports every field |
| TC15 | `tests/accounts/accounts.spec.ts` | Accounts Overview lists every account, its available amount and a correct total |
| TC16 | `tests/accounts/accounts.spec.ts` | opening a CHECKING/SAVINGS account moves the deposit and nothing else |
| TC17 | `tests/accounts/accounts.spec.ts` | the account detail matches the overview row and the backend record |
| TC18 + TC19 | `tests/accounts/transfer.spec.ts` | a transfer moves exactly the amount and is recorded on both accounts |
| TC21 | `tests/accounts/billpay.spec.ts` | an empty Bill Pay form reports every field and pays nothing |
| TC23 | `tests/accounts/findtrans.spec.ts` | every search criterion finds the transaction the test created · a malformed date is rejected client-side |
| TC24 | `tests/accounts/loan.spec.ts` | an approved loan takes the down payment and opens a funded LOAN account |
| TC25 | `tests/accounts/loan.spec.ts` | a loan far beyond the available funds is denied and creates nothing |
| TC26 | `tests/accounts/profile.spec.ts` | an updated profile persists and matches the backend record |
| TC27 | `tests/accounts/profile.spec.ts` | clearing the required fields is rejected and leaves the profile intact |
| TC28 | `tests/api/rest.spec.ts` | the API reports the same account as the UI |

Tests prefixed `D##` do not cover a functional case: they **pin a defect in the
application** so they break the day it is fixed. They run in the separate
`known-defect` project and are catalogued in `STRATEGY.md`.

## Cases that are not automated

**TC08, TC10, TC20 and TC22 are not in the suite.** That is not an oversight: the
tests existed, failed reproducibly, and failed because the application is broken, not
the test. They were withdrawn so that green means something, and the finding is kept
as a documented defect in `STRATEGY.md` (D17 through D20). What the application
actually does in each case is recorded there.

---

## Structure

```
src/
  core/         BasePage and BaseComponent
  components/   LoginPanel, AccountServicesMenu
  pages/        one page object per screen (12)
  flows/        SessionFlow, CustomerFlow — registration, login, data setup
  fixtures/     test.ts — injects pages, an open session and the API client
  data/         factories producing data unique per run and worker
  setup/        remote-environment preflight
  support/      REST client + runtime contracts, errors, money and dates
tests/
  public/       public site, no session
  auth/         registration, login, lookup
  accounts/     accounts, transfers, bill pay, loans, search, profile
  api/          REST verification
  unit/         hermetic helpers and factories, no browser or network
```
