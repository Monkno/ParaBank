import { request, type FullConfig } from '@playwright/test';
import { ContractError, EnvironmentUnavailableError, RateLimitError } from '../support/errors';

const DEFAULT_BASE_URL = 'https://parabank.parasoft.com';
const PROBES = [
  { path: '/parabank/index.htm', marker: 'ParaBank' },
  { path: '/parabank/register.htm', marker: 'customerForm' },
] as const;

function classifyFailure(path: string, status: number, body: string): Error {
  if (status === 429 || /Error 1015|being rate limited/i.test(body)) {
    return new RateLimitError(
      `Preflight ${path} returned HTTP ${status}: the shared ParaBank demo is rate limiting this runner. ` +
        'Wait for the limit to clear before retrying; do not increase WORKERS.',
    );
  }
  return new EnvironmentUnavailableError(
    `Preflight ${path} returned HTTP ${status}; the remote demo is not healthy enough to start the suite.`,
  );
}

export default async function preflight(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? process.env.BASE_URL ?? DEFAULT_BASE_URL;
  const client = await request.newContext({ baseURL });

  try {
    for (const probe of PROBES) {
      let response;
      try {
        response = await client.get(probe.path, { timeout: 30_000 });
      } catch (error) {
        throw new EnvironmentUnavailableError(
          `Preflight could not reach ${probe.path}; the remote demo is unavailable.`,
          { cause: error },
        );
      }

      const body = await response.text();
      if (!response.ok()) {
        throw classifyFailure(probe.path, response.status(), body);
      }
      if (!body.includes(probe.marker)) {
        throw new ContractError(
          `Preflight ${probe.path} returned HTTP 200 but did not contain the expected ParaBank marker ` +
            `${JSON.stringify(probe.marker)}.`,
        );
      }
    }
    console.log(`Preflight passed against ${baseURL}`);
  } finally {
    await client.dispose();
  }
}
