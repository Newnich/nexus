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

/** Navigate to new-item form, fill title + URL, submit, and wait for redirect to dashboard. */
export async function createTestItem(page: Page, title: string, url: string) {
  await page.goto("/items/new");
  await page.waitForSelector('input[name="title"]', { timeout: 15000 });
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="url"]', url);
  await page.click('button[type="submit"]');
  // Form redirects to /dashboard after saving
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}
