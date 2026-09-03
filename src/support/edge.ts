import type { Page, Response } from '@playwright/test';

/**
 * Cloudflare sits in front of the shared demo and sometimes answers a navigation
 * with its own page instead of ParaBank's. Two different things arrive as a
 * 4xx/5xx and they need opposite treatment, so they are told apart here rather
 * than surfacing as an unexplained locator timeout thirty seconds later.
 *
 *   403 + "Performing security verification"
 *       A managed bot challenge. It runs its JavaScript, solves itself and
 *       reloads into the real page, so the correct response is to wait for
 *       ParaBank's own shell and carry on. Observed once during a three-worker
 *       registration run; the run that hit it had no other symptom.
 *
 *   429 / 503 + "Error 1015 - You are being rate limited"
 *       A temporary ban on the source address. Measured while probing: three
 *       browser contexts submitting a form in a tight loop tripped it after
 *       roughly 60 POSTs in 40 seconds, and every request from that address —
 *       browser and curl alike — was refused for several minutes afterwards.
 *       No amount of waiting inside a test fixes this, so it is turned into a
 *       message that names the cause and the lever (WORKERS) instead of a
 *       mystery failure.
 *
 * This is the reason the suite runs at a low worker count and does no
 * speculative navigation: request volume against this host is a finite budget.
 */
const EDGE_STATUSES = new Set([403, 429, 503]);

/** Present on every page ParaBank itself serves, and on none that Cloudflare serves. */
const PARABANK_SHELL = '#mainPanel';

const CHALLENGE_TIMEOUT_MS = 60_000;

/**
 * Returns the status the caller should act on: 200 once a bot challenge has
 * cleared into a real ParaBank page, the original status otherwise.
 */
export async function settleEdge(page: Page, path: string, response: Response | null): Promise<number> {
  if (!response) {
    throw new Error(`GET ${path} produced no response`);
  }

  const status = response.status();
  if (!EDGE_STATUSES.has(status)) {
    return status;
  }

  const body = await page.content().catch(() => '');

  if (/Error 1015|being rate limited/i.test(body)) {
    throw new Error(
      `GET ${path} returned HTTP ${status}: Cloudflare is rate limiting this run ` +
        `("Error 1015 — you are being rate limited"). The shared demo throttles by source ` +
        `address; lower WORKERS or wait for the ban to lapse before re-running.`,
    );
  }

  if (/Performing security verification|challenge-platform|Just a moment/i.test(body)) {
    const cleared = await page
      .locator(PARABANK_SHELL)
      .waitFor({ state: 'attached', timeout: CHALLENGE_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);

    if (!cleared) {
      throw new Error(
        `GET ${path} returned HTTP ${status}: Cloudflare's bot challenge did not clear ` +
          `within ${CHALLENGE_TIMEOUT_MS / 1000}s.`,
      );
    }
    return 200;
  }

  return status;
}
