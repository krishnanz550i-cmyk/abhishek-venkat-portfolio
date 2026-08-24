import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

/**
 * Launches Chromium for the browser tests.
 *
 * Some environments ship a pinned Chromium whose build number does not match the
 * npm playwright package, so Playwright cannot find it by itself. If that build
 * is present we point straight at it; otherwise we let Playwright resolve its
 * own download, which is what happens in CI.
 */
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export const launch = (opts = {}) => chromium.launch({
  ...(existsSync(PINNED) ? { executablePath: PINNED } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  ...opts,
});
