# ParaBank — E2E suite (Playwright + TypeScript)

End-to-end suite against Parasoft's demo online banking application,
**https://parabank.parasoft.com/parabank/index.htm**.

**72 tests, green with no retries, ~1.5 min on 2 workers.**

The cases live in [`TEST_CASES.md`](./TEST_CASES.md); the design decisions and the
defects found in the application, in [`STRATEGY.md`](./STRATEGY.md).

---

## Install and run

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env
npm test
```

Useful commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the whole suite |
| `npm test -- --headed` | With a visible browser |
| `npm test -- --grep @auth` | Registration and authentication only |
| `npm test -- --grep @accounts` | Account operations only |
| `npm test -- --grep @unit` | Money helpers only (no network) |
| `npm run report` | Opens the last HTML report |
| `npx tsc --noEmit` | Typecheck |

### Why the default is 2 workers

Measured, not chosen by habit. At 4 workers the suite trips the Cloudflare rate
limiting in front of the demo and tests start failing on truncated responses. At 2
workers it runs clean in ~1.5 min. Override with `WORKERS` in `.env` or `--workers=N`,
at your own risk.

### Configuration

`.env.example` documents the variables. The only required one is `BASE_URL`.

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
application** so they break the day it is fixed. They are catalogued in `STRATEGY.md`.

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
  data/         factories producing data unique per worker
  support/      api.ts (REST client), money.ts (integer-cent arithmetic), dates.ts
tests/
  public/       public site, no session
  auth/         registration, login, lookup
  accounts/     accounts, transfers, bill pay, loans, search, profile
  api/          REST verification
  unit/         money helpers, no network
```
