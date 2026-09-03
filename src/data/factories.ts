import { faker } from '@faker-js/faker';
import type { Customer, Payee } from './types';

/**
 * A token unique per worker and per millisecond, and recognisable as belonging
 * to this suite. Everything the suite writes to the shared demo carries one, so
 * a leftover row can be traced to a run and never confused with a human's data.
 *
 * `TEST_WORKER_INDEX` and not a random number alone: two workers starting in the
 * same millisecond is not hypothetical at three-way parallelism, and a username
 * collision on ParaBank does not fail loudly — it silently re-renders the
 * registration form with "This username already exists."
 */
export function uniqueTag(): string {
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return `${worker}${Date.now()}${faker.string.numeric(3)}`;
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
    street: `${faker.number.int({ min: 1, max: 9999 })} ${faker.location.street()}`,
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode('#####'),
    phoneNumber: faker.string.numeric(10),
    // Formatted like a real SSN but drawn from the whole space, so two parallel
    // workers colliding is a 1-in-10^9 event rather than a certainty.
    ssn: `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,
    username: `qa${tag}`,
    password: customerPassword(),
    ...overrides,
  };
}

export function buildPayee(overrides: Partial<Payee> = {}): Payee {
  const tag = uniqueTag();
  return {
    name: `Payee ${tag}`,
    street: `${faker.number.int({ min: 1, max: 9999 })} ${faker.location.street()}`,
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode('#####'),
    phoneNumber: faker.string.numeric(10),
    accountNumber: faker.string.numeric(5),
    ...overrides,
  };
}
