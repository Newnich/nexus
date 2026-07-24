import { expect, Page } from "@playwright/test";

// ═════════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════════

export const TEST_EMAIL = "demo@nexus.app";
export const TEST_PASSWORD = "demo123456";

// ═════════════════════════════════════════════════════════════════════════════
// Auth
// ═════════════════════════════════════════════════════════════════════════════

/** Sign in via the browser login form and wait for dashboard redirect. */
export async function signIn(page: Page) {
  await page.goto("/auth/login");
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// Item Helpers
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Options for {@link createTestItem}.
 */
export interface CreateTestItemOptions {
  /**
   * Optional callback invoked just before clicking the submit button (first
   * attempt only — retries reuse the form state from the initial attempt).
   * Useful for tests that need to add tags, fill additional fields, etc.
   *
   * @note The callback runs only on the first submission attempt, not on retry.
   * This is safe because React preserves form state (e.g., added tags) across
   * failed submissions. If your callback performs non-idempotent actions, make
   * sure they are safe to skip on retry.
   */
  onBeforeSubmit?: (page: Page) => Promise<void>;
}

/**
 * Navigate to new-item form, fill title + URL + optional extra setup, submit,
 * and wait for redirect to dashboard. Attempts submission up to 3 times with
 * progressive timeouts if the API call fails (e.g., transient JWT/auth issues
 * when running with parallel workers in CI).
 */
export async function createTestItem(
  page: Page,
  title: string,
  url: string,
  options?: CreateTestItemOptions,
) {
  const { onBeforeSubmit } = options ?? {};

  await page.goto("/items/new");
  await page.waitForSelector('input[name="title"]', { timeout: 15000 });
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="url"]', url);

  if (onBeforeSubmit) {
    await onBeforeSubmit(page);
  }

  const submitAndWaitForRedirect = async (timeout: number) => {
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout });
  };

  // Progressive timeouts: each retry waits longer for the clock skew to resolve
  const timeouts = [15000, 20000, 30000];

  for (let i = 0; i < timeouts.length; i++) {
    try {
      await submitAndWaitForRedirect(timeouts[i]);
      return; // Success — navigation happened
    } catch (error) {
      if (i === timeouts.length - 1) {
        // Last attempt failed — propagate the error
        throw error;
      }
      // Transient failure (JWT clock skew, rate limiting, etc.).
      // The form stays on /items/new with values intact.
      // Wait briefly for saving state to clear, then check form visibility.
      await page.waitForTimeout(1000);
      const isStillOnForm = await page.locator('input[name="title"]').isVisible();
      if (!isStillOnForm) {
        // Navigated away from the form page unexpectedly — fail fast
        throw error;
      }
      // Loop continues with next (longer) timeout
    }
  }
}

/**
 * Navigate to the items page and expect a specific item title to be visible.
 * If the assertion fails (e.g., due to a transient API error), reload the page
 * and retry once before giving up.
 */
export async function expectItemVisible(page: Page, title: string, timeout: number = 25000) {
  await page.goto("/items");

  try {
    await expect(page.getByText(title).first()).toBeVisible({ timeout });
  } catch {
    // The items API may have failed (same JWT/auth issue as create).
    // Reload the page to force a fresh fetch.
    await page.reload();
    await expect(page.getByText(title).first()).toBeVisible({ timeout });
  }
}
