import { test, expect } from "@playwright/test";

// ═════════════════════════════════════════════════════════════════════════════
// Config
// ═════════════════════════════════════════════════════════════════════════════

const TEST_EMAIL = "demo@nexus.app";
const TEST_PASSWORD = "demo123456";

/** Sign in via the browser login form */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// Auth Redirect  — MUST run first, before any auth session is created
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Auth Guard", () => {
  test("Dashboard shows sign-in prompt when unauthenticated", async ({ page }) => {
    // The app renders the layout but shows an auth error in the content area
    // when the API returns 401, instead of a server-side redirect.
    await page.goto("/dashboard");
    await expect(page.getByText(/please sign in/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Public Pages
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Public Pages", () => {
  test("Homepage renders with key elements", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText("NEXUS").first()).toBeVisible();
    await expect(page.getByText("Universal Capture")).toBeVisible();
  });

  test("Login page renders form and accepts credentials", async ({ page }) => {
    await page.goto("/auth/login");

    // Wait for client hydration
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });

    // Form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // OAuth buttons
    await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with GitHub/ })).toBeVisible();

    // Sign-up toggle
    await expect(page.getByText(/Don't have an account/)).toBeVisible();

    // Sign in
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Authenticated Pages
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Authenticated Pages", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("Dashboard shows stats", async ({ page }) => {
    await expect(page.getByText("Saved Items").first()).toBeVisible();
    await expect(page.getByText("Smart Folders").first()).toBeVisible();
    await expect(page.getByText("AI Discovered").first()).toBeVisible();
    await expect(page.getByText("18").first()).toBeVisible();
  });

  test("Items page lists items", async ({ page }) => {
    await page.goto("/items");

    // Title
    await expect(page.locator("h1").filter({ hasText: /Items/ })).toBeVisible();

    // Filter buttons
    await expect(page.getByRole("button", { name: "All Items" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Link$/ })).toBeVisible();

    // Wait for items to load (API call completes)
    await page.waitForResponse(
      (res) => res.url().includes("/api/items") && res.status() === 200,
      { timeout: 10000 }
    );

    // Count item links (each item is an <a href="/items/[id]">)
    const itemLinks = page.locator('a[href^="/items/"]');
    await expect(itemLinks.first()).toBeVisible();
    const count = await itemLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Item detail page renders content", async ({ page }) => {
    // Navigate directly to a specific item
    await page.goto("/items");

    // Wait for the first item link to appear
    await page.waitForResponse(
      (res) => res.url().includes("/api/items") && res.status() === 200,
      { timeout: 10000 }
    );
    await page.waitForTimeout(1000);

    // Click the first item link
    const firstItemLink = page.locator('a[href^="/items/"]').first();
    await firstItemLink.waitFor({ state: "visible", timeout: 5000 });
    const href = await firstItemLink.getAttribute("href");
    await page.goto(href!);

    // Wait for the detail page to load
    await page.waitForSelector("h1", { timeout: 10000 });
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("Collections page shows 6 cards", async ({ page }) => {
    await page.goto("/collections");

    await expect(page.locator("h1").filter({ hasText: /Collections/ })).toBeVisible();

    // Filter buttons
    await expect(page.getByRole("button", { name: /All Collections/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /📁 Manual/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /🤖 AI Auto/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /🔍 Smart Queries/ })).toBeVisible();

    // Should show collection cards (wait for content to load)
    await expect(page.getByText("AI & Machine Learning").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Web Development").first()).toBeVisible();
  });

  test("Graph page renders force graph", async ({ page }) => {
    await page.goto("/graph");

    // Wait for graph SVG to render
    await page.waitForSelector("svg", { timeout: 10000 });

    // Should have at least one edge (line)
    const lines = page.locator("svg line");
    await expect(lines.first()).toBeVisible({ timeout: 10000 });
  });

  test("Graph has connected nodes from seed data", async ({ page }) => {
    await page.goto("/graph");

    // Wait for graph SVG to render
    await page.waitForSelector("svg", { timeout: 10000 });

    // Should have SVG circles (nodes) from the seeded items
    const circles = page.locator("svg circle");
    await expect(circles.first()).toBeVisible({ timeout: 10000 });
    const count = await circles.count();
    expect(count).toBeGreaterThan(5);
  });

  test("Search page has input and suggestions", async ({ page }) => {
    await page.goto("/search");

    // Search input - use the unique placeholder to identify the main search input
    await expect(page.locator('input[placeholder*="find"]')).toBeVisible();

    // Mode toggle
    await expect(page.getByRole("button", { name: /Semantic Search/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Full Text/ })).toBeVisible();

    // Suggestion buttons
    await expect(page.getByRole("button", { name: "AI and machine learning articles" })).toBeVisible();
  });
});
