# Test Cases — ParaBank (parabank.parasoft.com)

ParaBank is Parasoft's demo online banking application. It **publishes no official
list of test cases**, so the ones below were derived by exploring the live
application on **2026-09-03**: navigating the site, inspecting the DOM of its forms,
and probing the public REST API.

Each case carries a `TC##` id that maps to its automated test. The exact
TC## → file:test mapping lives in `README.md`.

**Verification legend**

- ✅ **Observed** — confirmed manually during exploration.
- 🔎 **Automated** — the case is covered by a test that runs green.
- ❌ **Not automated** — the test was withdrawn: the application does not do what the
  case describes, and the deviation is recorded as a defect in `STRATEGY.md`. See
  section 6 of that document.
- ⚠️ **Deviation** — the application does not behave as the case said. **The
  application wins**: the case was rewritten to describe what the application
  actually does, and the deviation was recorded as a defect in `STRATEGY.md`. The
  assertion follows what was observed; it was not loosened to make the test pass.

**Base URL:** `https://parabank.parasoft.com/parabank/index.htm`
(without the `jsessionid` the application appends to every link — see D15 in
`STRATEGY.md`).

---

## A. Public site

### TC01 — The home page loads with the login panel and the information sections ✅ 🔎

1. Open the home page.

**Expected:** title `ParaBank | Welcome | Online Banking`; a *Customer Login* form
with `input[name=username]`, `input[name=password]` and a *Log In* button; links to
*Register* and *Forgot login info?*; non-empty news and services sections.

### TC02 — The main navigation reaches every page of the site ✅ 🔎 ⚠️

1. Walk *Home*, *About Us*, *Services*, *Site Map*, *Contact Us* from the footer.

**Expected:** every destination answers HTTP 200 with its own title and its own
content; no internal link is broken.

> ⚠️ **Deviation (D08).** `services.htm` does not show ParaBank's services: it serves
> the Apache CXF *service list* of an unrelated SOAP demo (Parasoft Bookstore),
> injecting a complete HTML document — `<!DOCTYPE>`, `<html>`, `<head>`, `<title>` —
> inside `<div id="rightPanel">`, and publishing a WS-Security username and password
> (`soatest`/`soatest`) in the body. The case was adjusted to what the application
> does, and a dedicated test (`D08`) fails the day it is fixed.

### TC03 — The Contact Us form accepts an enquiry ✅ 🔎

1. Open *Contact Us*, fill in name, email, phone and message, and submit.

**Expected:** the confirmation names the sender (`Thank you <name>`) and states that a
representative will be in touch; the form disappears.

### TC04 — An empty Contact Us shows the validation for every field ✅ 🔎

1. Submit the contact form with nothing filled in.

**Expected:** exactly four messages — *Name / Email / Phone / Message is required.* —
the form stays on screen and the enquiry is not sent.

---

## B. Registration and authentication

> Every test registers its own user, with a username, first name, last name and SSN
> unique per worker and per millisecond. A pre-existing user is never reused or
> modified: the database is shared.

### TC05 — Registering a new user ✅ 🔎

1. Open *Register*, fill in the eleven fields and submit.

**Expected:** `Welcome <username>` plus "Your account was created successfully. You
are now logged in."; the session is open; **one** CHECKING account is created with
whatever opening balance the server sets; and the stored record matches what was
typed field by field (first name, last name, full address, phone, SSN).

### TC06 — Registering with a username that already exists ✅ 🔎

1. Register a user. Try to register another with the same `customer.username` and
   every other field different.

**Expected:** a single error, *This username already exists.*; no second user is
created and the original is untouched (verified by signing back in as that user and
re-reading its record).

### TC07 — Registering with an empty form ✅ 🔎 ⚠️

1. Submit the registration form with nothing filled in.

**Expected:** ten required-field messages, in order: First name, Last name, Address,
City, State, Zip Code, Social Security Number, Username, Password, Password
confirmation.

> ⚠️ **Deviation (D10).** *Phone #* is **not** required, neither on registration nor
> on *Update Contact Info*, despite sitting among ten fields that are. The original
> case said "every required field"; the list was closed to the ten the application
> validates, and a dedicated test (`D10`) documents the exception.

### TC08 — Registering with passwords that do not match ✅ ❌

> ❌ **Not automated.** The test existed and failed reproducibly on a single worker,
> because the application does not do what this case describes. It was withdrawn
> rather than having its assertion loosened. The actual behaviour is documented as
> **D20** in `STRATEGY.md`.

1. Complete the registration with different `customer.password` and
   `repeatedPassword`.

**Expected:** a single error, *Passwords did not match.*, and no user created —
verified by attempting to sign in with **both** passwords.

### TC09 — Logging in with valid credentials ✅ 🔎

1. With an existing account and the browser **signed out**, log in from the home page.

**Expected:** *Accounts Overview* with that customer's accounts (and only those,
cross-checked against the API) and the side menu with its eight entries.

### TC10 — Logging in with invalid credentials ✅ ❌

> ❌ **Not automated.** The test existed and failed reproducibly on a single worker,
> because the application does not do what this case describes. It was withdrawn
> rather than having its assertion loosened. The actual behaviour is documented as
> **D19** in `STRATEGY.md`.

1. A username that does not exist. 2. A real username with the wrong password.

**Expected:** *The username and password could not be verified.*; the private area is
not reached; and the real account remains usable after the rejection.

### TC11 — Logging in with empty fields ✅ 🔎

1. Submit the login form with nothing filled in.

**Expected:** *Please enter a username and password.*; no session is started.

### TC12 — Logging out ends the session ✅ 🔎

1. While signed in, use *Log Out*.

**Expected:** the browser returns to `/parabank/index.htm` with the login panel, and
the same private URL that worked a second earlier stops working.

### TC13 — Private pages are protected without a session ✅ 🔎 ⚠️

1. With no session, navigate directly to `overview.htm`, `transfer.htm` and
   `billpay.htm`.

**Expected:** all three answer **HTTP 500** with the generic *An internal error has
occurred and has been logged.* page; no account row and no private menu leak.

> ⚠️ **Deviation (D03).** The original case expected a redirect to the login or a
> session error. ParaBank does neither: it returns 500 and a generic trace. The
> assertion follows the application. A 500 leaks no data, but it turns an
> authorisation problem into a server error and makes it impossible to tell apart
> from a real outage.
>
> ⚠️ **Related deviation (D04).** `activity.htm?id=<n>` is **not** protected this way:
> it answers 200 and renders its full shell, deferring the rejection to the AJAX call
> against the authenticated proxy. Nothing leaks today, but the server-side guard is
> simply absent. Covered by the `D04` test.

### TC14 — Forgot login info returns the customer's credentials ✅ 🔎 ⚠️

1. Open *Forgot login info?* and fill in the customer's exact personal details.

**Expected:** *Your login information was located successfully. You are now logged
in.* followed by `Username: <u>` and `Password: <p>` in plain text, **and the session
is opened**. With a single field wrong (the SSN, for instance) it answers *The
customer information provided could not be found.* and opens no session. Empty, it
lists the seven required fields.

> ⚠️ **Deviation (D02).** The case said "shows the username and the password". It does
> that **and also signs the visitor in**. Combined with D01 —
> `GET /services/bank/customers/{id}` hands the name, address and SSN to an anonymous
> caller — the full chain is an account takeover starting from an account number.
>
> ⚠️ **Data note.** The lookup requires the personal details to be **unique across the
> whole database**: if two customers share name + address + SSN, it answers "not
> found". That is why the factory generates a unique first name, last name and SSN,
> not just a unique username.

---

## C. Accounts

### TC15 — Accounts Overview lists the accounts with their balances ✅ 🔎

1. Sign in, open a second account (so the total is a real sum) and open *Accounts
   Overview*.

**Expected:** one row per account with number, balance and available amount; the
available amount is `max(balance, 0)`; and the *Total* row is exactly the sum of the
balances the table itself printed. Every amount is cross-checked against
`GET /customers/{id}/accounts`, never against literals.

### TC16 — Opening a new account ✅ 🔎

1. *Open New Account*, choose the type (CHECKING or SAVINGS) and the source account.

**Expected:** the new account number is shown; the account appears in the overview
with the chosen type and belongs to this customer; **the source balance drops by
exactly the deposit and the new account holds exactly that amount**; and the
customer's total does not change.

> **Data note.** The minimum deposit ($100.00 per the page text) is a global server
> parameter (`minimumBalance`) that anyone can change from `admin.htm`. The test
> **derives** it from what actually left the source account instead of hardcoding it.

### TC17 — The account detail shows the correct data ✅ 🔎

1. From the overview, click the account number.

**Expected:** number, type, balance and available amount match the overview row and
the API. A newly created account shows *No transactions found.* and zero rows.

### TC18 — Transferring funds between accounts ✅ 🔎

1. *Transfer Funds*: amount, source account, destination account, confirm.

**Expected:** the confirmation repeats the amount and the accounts; **the source drops
by exactly that amount, the destination rises by exactly that amount, and the sum of
the two does not change**. The assertion is arithmetic over balances read before and
after.

### TC19 — The transfer is recorded in the account activity ✅ 🔎

1. After the transfer, open the detail of both accounts.

**Expected:** on the destination, a credit for the amount described *Funds Transfer
Received* with an empty debit column; on the source, a debit for the same amount
described *Funds Transfer Sent*.

> **Redundancy note.** TC18 and TC19 are one operation verified at two levels, so they
> share a single transfer (`TC18 + TC19` in `transfer.spec.ts`). See `STRATEGY.md`,
> "Redundancy".

### TC20 — Paying a bill (Bill Pay) ✅ ❌

> ❌ **Not automated.** The test existed and failed reproducibly on a single worker,
> because the application does not do what this case describes. It was withdrawn
> rather than having its assertion loosened. The actual behaviour is documented as
> **D17** in `STRATEGY.md`.

1. *Bill Pay*: payee, address, phone, account number and its verification, amount and
   source account.

**Expected:** the confirmation names the payee, the amount and the account; **the
source balance drops by exactly that amount**; and a debit *Bill Payment to
`<payee>`* for that amount appears in the account activity.

### TC21 — Bill Pay with an empty form ✅ 🔎

1. Submit *Bill Pay* with nothing filled in.

**Expected:** exactly nine visible messages — name, address, city, state, zip code,
phone, *Account number is required.* twice (once for `Account #` and once for *Verify
Account #*) and *The amount cannot be empty.* — the server is not called and no
balance changes.

### TC22 — Bill Pay with a mismatched confirmation account ✅ ❌

> ❌ **Not automated.** The test existed and failed reproducibly on a single worker,
> because the application does not do what this case describes. It was withdrawn
> rather than having its assertion loosened. The actual behaviour is documented as
> **D18** in `STRATEGY.md`.

1. Complete *Bill Pay* with different `Account #` and `Verify Account #`.

**Expected:** a single error, *The account numbers do not match.*; no payment is made
and no balance changes. Correcting **only** the confirmation makes the same form
submit successfully, which proves the rejection was for that reason and nothing else.

### TC23 — Finding transactions ✅ 🔎

1. *Find Transactions*, searching by transaction ID, by date, by date range and by
   amount.

**Expected:** each criterion returns exactly the transaction the test itself created,
with the correct amount, description and date. A non-existent amount returns zero
rows. A malformed date shows *Invalid date format* and runs no search.

> **Data note.** The date is taken from the transaction the server returned, never
> from the machine clock: the two disagree around midnight. See also D07.
>
> **Scope note.** *Find by Transaction ID* hits
> `services_proxy/bank/transactions/{id}`, which is **not** scoped to the selected
> account. Recorded as part of D11.

### TC24 — Requesting a loan (approved) ✅ 🔎

1. *Request Loan*: amount 1000, down payment 100, source account.

**Expected:** *Approved* with a provider and a date; a **LOAN** account is created
with a balance equal to the amount lent; **the down payment, and only the down
payment, leaves the source account**; the new account appears in the overview.

> **Data note.** The decision depends on `loanProcessorThreshold`, a global parameter
> that can be changed from `admin.htm`. If this case turns *Denied* with no code
> change, someone moved that parameter; the assertion message says so explicitly.

### TC25 — Requesting a disproportionate loan ✅ 🔎

1. Request an amount far above the available balance.

**Expected:** *Denied* with the reason *We cannot grant a loan in that amount with
your available funds.*; **no** account is created and the down payment is **not**
charged.

### TC26 — Updating the contact information ✅ 🔎

1. *Update Contact Info*: the form arrives pre-filled with the registered profile.
   Change first name, last name, full address and phone, and save.

**Expected:** *Profile Updated*; the new data survives a page reload and matches the
backend record field by field; the SSN, which is not on this form, does not change.

### TC27 — Update Contact Info with empty fields ✅ 🔎

1. Clear the six required fields and save.

**Expected:** six required-field messages; no success panel is shown; the backend
record keeps **all** previous values and the form offers them again after a reload.

---

## D. REST API

### TC28 — The API reports the same balances as the UI ✅ 🔎

1. Read an account through the UI (`activity.htm`).
2. Read `GET /services/bank/accounts/{id}` with `Accept: application/json`.

**Expected:** `id`, `customerId`, `type` and `balance` match what the interface shows,
and the two mounts of the same resource (`services` and `services_proxy`) agree with
each other.

---

## E. Added cases — gaps in the original list

These were not in the derived list. They cover negative paths, boundaries and
authorisation, which is where real defects tend to live. Each carries the id of the
defect it documents in `STRATEGY.md`.

| ID | What it verifies |
| --- | --- |
| D01 | Balances, history and personal data (including the SSN) readable **without a session** |
| D04 | `activity.htm` served without a session while its siblings return 500 |
| D05 | `updateprofile.htm` embeds the customer's username and password in the HTML |
| D06 | The public WADL advertises `cleanDB`, `initializeDB` and `setParameter` (**never invoked**) |
| D07 | Every transaction date is displayed one day early west of UTC |
| D08 | *Services* serves an unrelated CXF service list, with credentials |
| D09 | Contact Us accepts an email and a phone number in any format |
| D10 | *Phone #* is optional on registration and on profile update |
| D11 | A signed-in customer can read another customer's account detail |
| D12 | *Transfer Funds* with an empty amount shows an internal error, not its validation |
| D13 | *Bill Pay* allows an overdraft and leaves the balance negative |
| D14 | An approved loan credits the new account with no transaction to explain it |
| D15 | The `jsessionid` travels in the URL of every internal link |
| D16 | The logout redirect discloses the backend connection type |

---

## Execution constraints (mandatory)

`parabank.parasoft.com` is a **shared, public** instance. The suite:

- **Never touches `admin.htm`**, nor `services/bank/cleanDB`, `initializeDB` or
  `setParameter`. It asserts that they exist and are open (D06) by reading the WADL;
  it does not invoke them.
- **Creates its own customer in every test** and operates only on that customer's
  accounts.
- **Assumes no fixed balances or IDs.** The opening balance measured during
  exploration was $515.00, not the default $500.00: someone had already changed the
  global parameter. No test hardcodes an opening amount.
- **Runs on 2 workers.** Measured: at 4, the instance returns Cloudflare HTTP 429
  after 35 seconds. See `STRATEGY.md`, "The Cloudflare rate limit".

---

## Coverage deliberately out of scope

- **SOAP:** `services/ParaBank?wsdl` is not covered; the suite is UI plus REST
  verification.
- **Accessibility and cross-browser:** the suite runs on Chromium.
- **Banking concurrency:** simultaneous transfers on the same account.
- **Destructive exploitation of D06:** documented, never executed.
