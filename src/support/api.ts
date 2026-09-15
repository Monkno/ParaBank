import type { APIRequestContext } from '@playwright/test';
import type { Account, CustomerRecord, Transaction } from '../data/types';
import { parseAccount, parseAccounts, parseCustomer, parseTransactions } from './contracts';
import { EnvironmentUnavailableError, RateLimitError, SettlementTimeoutError } from './errors';

/**
 * ParaBank publishes the *same* JAX-RS resource twice, and the difference
 * matters enough that this client is parameterised by which one it talks to:
 *
 *   `/parabank/services/bank/...`        answers 200 to anyone, no session.
 *   `/parabank/services_proxy/bank/...`  answers 401 `{"message":"User login
 *                                        required"}` without a session cookie.
 *
 * Every balance and transaction assertion in the suite goes through the
 * *authenticated proxy*, driven by `page.request` so it shares the browser
 * context's `JSESSIONID`. That is deliberate: verifying the UI against the
 * unauthenticated mirror would make the whole suite depend on defect D01
 * continuing to exist, and the day it is fixed thirty tests would go red for
 * the wrong reason.
 *
 * The unauthenticated base is used in exactly one place — `tests/api/rest.spec.ts`,
 * where the absence of authentication is the finding under test.
 */
export const AUTHENTICATED_BANK_API = '/parabank/services_proxy/bank';
export const PUBLIC_BANK_API = '/parabank/services/bank';

export class BankApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly basePath: string = AUTHENTICATED_BANK_API,
  ) {}

  private async getJson(path: string): Promise<unknown> {
    const url = `${this.basePath}${path}`;

    // The shared demo occasionally answers a 200 with an empty or truncated body
    // under load — a transient hiccup, not a real absence of data. Two quick
    // retries turn that noise into a correct read; a persistent one still throws
    // with a message that says exactly what came back. This is not hiding a
    // defect: an endpoint that is genuinely down fails all three attempts.
    let lastBody = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.request.get(url, { headers: { Accept: 'application/json' } });
      if (!response.ok()) {
        const status = response.status();
        const body = await response.text();
        const detail = JSON.stringify(body.slice(0, 240));
        if (status === 429 || /Error 1015|being rate limited/i.test(body)) {
          throw new RateLimitError(
            `GET ${url} returned HTTP ${status}: the shared ParaBank demo is rate limiting this run. ` +
              'Wait before retrying and do not increase WORKERS.',
          );
        }
        if ([502, 503, 504].includes(status)) {
          throw new EnvironmentUnavailableError(`GET ${url} returned HTTP ${status}: ${detail}`);
        }
        throw new Error(`GET ${url} returned HTTP ${status}: ${detail}`);
      }
      lastBody = await response.text();
      try {
        return JSON.parse(lastBody) as unknown;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }
    throw new Error(`GET ${url} returned HTTP 200 with a non-JSON body three times: ${JSON.stringify(lastBody.slice(0, 120))}`);
  }

  /** Status only, for the cases where a non-200 is the observation. */
  async statusOf(path: string): Promise<number> {
    const response = await this.request.get(`${this.basePath}${path}`, {
      headers: { Accept: 'application/json' },
    });
    return response.status();
  }

  async getAccount(accountId: number): Promise<Account> {
    const path = `/accounts/${accountId}`;
    return parseAccount(await this.getJson(path), `${this.basePath}${path}`);
  }

  async listAccounts(customerId: number): Promise<Account[]> {
    const path = `/customers/${customerId}/accounts`;
    return parseAccounts(await this.getJson(path), `${this.basePath}${path}`);
  }

  async getCustomer(customerId: number): Promise<CustomerRecord> {
    const path = `/customers/${customerId}`;
    return parseCustomer(await this.getJson(path), `${this.basePath}${path}`);
  }

  async listTransactions(accountId: number): Promise<Transaction[]> {
    const path = `/accounts/${accountId}/transactions`;
    return parseTransactions(await this.getJson(path), `${this.basePath}${path}`);
  }

  /**
   * The balance in dollars as the backend holds it. Callers convert to cents
   * with `dollarsToCents` before comparing — never here, so that the conversion
   * used on the API side of a comparison is visible at the comparison.
   */
  async balanceOf(accountId: number): Promise<number> {
    return (await this.getAccount(accountId)).balance;
  }
}

/**
 * ParaBank processes money movements asynchronously. A `POST` to `transfer`,
 * `billpay`, `createAccount` or `requestLoan` returns 200 the moment the request
 * is *accepted*, and the balance and the transaction row appear a beat later —
 * measured at anything from immediate to several seconds under load, because the
 * work is drained from a JMS queue the WADL exposes as
 * `startupJmsListener`/`shutdownJmsListener`.
 *
 * So a balance read taken the instant the UI shows "Transfer Complete!" can be
 * stale, and an assertion on it is racing the server. These helpers are the
 * web-first wait for that race: they poll a *real* condition — the balance has
 * moved off its pre-operation value, or the account now has N transactions — and
 * hand back the settled figure. The test then asserts the exact amount on top.
 *
 * The waited-for condition ("it changed") is deliberately weaker than the
 * asserted one ("it changed by exactly X"), so the wait cannot make a wrong
 * amount pass: settling to the wrong number still fails the arithmetic. This is
 * the opposite of a fixed sleep — there is no sleep, and a genuinely stuck
 * transaction fails as a named timeout, not a silent zero.
 */
export interface SettleOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

async function poll<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  describe: (value: T) => string,
  { timeoutMs = 30_000, intervalMs = 500 }: SettleOptions,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await read();
      if (done(value)) {
        return value;
      }
      if (Date.now() >= deadline) {
        throw new SettlementTimeoutError(
          `Timed out after ${timeoutMs}ms waiting for the backend to settle; last observed ${describe(value)}`,
        );
      }
    } catch (error) {
      if (error instanceof SettlementTimeoutError) {
        throw error;
      }
      // A transient read failure is not the answer yet; keep polling. If it is
      // still failing at the deadline, report it rather than swallowing it.
      if (Date.now() >= deadline) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export interface Settler {
  /** Resolves once the account's balance differs from `fromDollars`, returning the new balance. */
  balanceChangedFrom(accountId: number, fromDollars: number, options?: SettleOptions): Promise<number>;
  /** Resolves once the account has at least `count` transactions, returning them. */
  atLeastTransactions(accountId: number, count: number, options?: SettleOptions): Promise<Transaction[]>;
}

export function settleWith(api: BankApi): Settler {
  return {
    async balanceChangedFrom(accountId, fromDollars, options = {}) {
      return poll(
        () => api.balanceOf(accountId),
        (balance) => balance !== fromDollars,
        (balance) => `balance ${balance} on account ${accountId} (unchanged from ${fromDollars})`,
        options,
      );
    },
    async atLeastTransactions(accountId, count, options = {}) {
      return poll(
        () => api.listTransactions(accountId),
        (transactions) => transactions.length >= count,
        (transactions) => `${transactions.length} transaction(s) on account ${accountId} (want ${count})`,
        options,
      );
    },
  };
}
