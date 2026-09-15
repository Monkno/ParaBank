import { randomInt } from 'node:crypto';
import type { Customer, Payee } from './types';

let sequence = 0;

/**
 * A token unique per worker and sequence, and recognisable as belonging to this
 * suite. CI supplies RUN_ID so a leftover row can be traced back to its workflow
 * execution; local runs fall back to the current timestamp.
 *
 * `TEST_WORKER_INDEX` and not a random number alone: concurrent workers share a
 * run identifier, and a username collision on ParaBank does not fail loudly —
 * it silently re-renders the registration form with "This username already
 * exists."
 */
export function uniqueTag(): string {
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  const configuredRun = process.env.RUN_ID?.replace(/\D/g, '').slice(-14);
  const run = configuredRun || String(Date.now());
  sequence += 1;
  return `${run}${worker}${String(sequence).padStart(3, '0')}`;
}

function numeric(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0');
}

function customerPassword(): string {
  return process.env.CUSTOMER_PASSWORD ?? 'Passw0rd1';
}

/**
 * A customer whose *personal* details are as unique as its username.
 *
 * This is not tidiness. `lookup.htm` ("Forgot login info?") matches on first
 * name + last name + full address + SSN and answers "The customer information
 * provided could not be found." when more than one customer matches — measured
 * during recon, after registering three customers that shared a name and an SSN.
 * A fixed `John Smith / 123-45-6789` fixture therefore passes TC14 on the first
 * run of the day and fails on every run after it.
 */
export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  const tag = uniqueTag();
  return {
    firstName: `Qa${tag}`,
    lastName: `Suite${tag}`,
    // Stable, ASCII-only defaults keep random punctuation and locale data from
    // turning ordinary regression tests into accidental input-fuzzing tests.
    // Boundary and encoding cases should override a field explicitly.
    street: `${randomInt(1, 10_000)} Automation Way`,
    city: 'Austin',
    state: 'TX',
    zipCode: numeric(5),
    phoneNumber: numeric(10),
    // Formatted like a real SSN but drawn from the whole space, so two parallel
    // workers colliding is a 1-in-10^9 event rather than a certainty.
    ssn: `${numeric(3)}-${numeric(2)}-${numeric(4)}`,
    username: `qa${tag}`,
    password: customerPassword(),
    ...overrides,
  };
}

export function buildPayee(overrides: Partial<Payee> = {}): Payee {
  const tag = uniqueTag();
  return {
    name: `Payee ${tag}`,
    street: `${randomInt(1, 10_000)} Automation Way`,
    city: 'Austin',
    state: 'TX',
    zipCode: numeric(5),
    phoneNumber: numeric(10),
    accountNumber: numeric(5),
    ...overrides,
  };
}
