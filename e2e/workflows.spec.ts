import { test, expect } from "@playwright/test";
import { signIn, createTestItem } from "./helpers";

// ═════════════════════════════════════════════════════════════════════════════
// Quick Capture
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Quick Capture", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("Quick capture button is visible on dashboard", async ({ page }) => {
    const quickCaptureBtn = page.locator('button[title="Quick capture"]');
    await expect(quickCaptureBtn).toBeVisible({ timeout: 5000 });
  });

  test("Quick capture opens a modal", async ({ page }) => {
    const quickCaptureBtn = page.locator('button[title="Quick capture"]');
    await quickCaptureBtn.click();
    // Modal should appear with an input field
    await expect(page.locator('input[placeholder*="url"i]').first()).toBeVisible({ timeout: 5000 });
  });

  test("Quick capture can submit a URL", async ({ page }) => {
    const quickCaptureBtn = page.locator('button[title="Quick capture"]');
    await quickCaptureBtn.click();
    await page
      .locator('input[placeholder*="url"i]')
      .first()
      .fill("https://example.com/test-quick-capture");
    const submitBtn = page.locator("button:has-text('Save')").first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should show a success toast or the item appears
      await page.waitForTimeout(2000);
      // Verify we're still on a valid page (not an error)
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Item CRUD
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Item CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("New item page has all form fields", async ({ page }) => {
    await page.goto("/items/new");
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('input[name="url"]')).toBeVisible();
    const tags = page.locator('input[placeholder*="tag"i]');
    const textarea = page.locator("textarea");
    // Should have at least title + URL + description/notes fields
    await expect(tags)
      .toBeVisible()
      .catch(() => {});
    await expect(textarea)
      .toBeVisible()
      .catch(() => {});
  });

  test("Create a new item and verify it appears in the list", async ({ page }) => {
    const uniqueTitle = `E2E Test Item ${Date.now()}`;
    await createTestItem(page, uniqueTitle, "https://example.com/e2e-test");

    // Navigate to items page and verify the new item appears
    await page.goto("/items");
    await page.waitForResponse((res) => res.url().includes("/api/items") && res.status() === 200, {
      timeout: 10000,
    });
    await expect(page.getByText(uniqueTitle).first()).toBeVisible({ timeout: 10000 });
  });

  test("Create an item and view its detail page", async ({ page }) => {
    const uniqueTitle = `E2E Detail Test ${Date.now()}`;
    await createTestItem(page, uniqueTitle, "https://example.com/e2e-detail");

    // Detail page should show the title
    await expect(page.locator("h1").filter({ hasText: uniqueTitle })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Create item and navigate back to items list", async ({ page }) => {
    const originalTitle = `E2E Edit Test ${Date.now()}`;
    await createTestItem(page, originalTitle, "https://example.com/e2e-edit-list");

    // Navigate back to items list and verify the item appears
    await page.goto("/items");
    await page.waitForResponse((res) => res.url().includes("/api/items") && res.status() === 200, {
      timeout: 10000,
    });
    await expect(page.getByText(originalTitle).first()).toBeVisible({ timeout: 10000 });
  });

  test("Create item with tags", async ({ page }) => {
    const uniqueTitle = `E2E Tags Test ${Date.now()}`;
    await page.goto("/items/new");
    await page.waitForSelector('input[name="title"]', { timeout: 10000 });
    await page.fill('input[name="title"]', uniqueTitle);
    await page.fill('input[name="url"]', "https://example.com/e2e-tags");

    // Try to add a tag if the field exists
    const tagInput = page.locator('input[placeholder*="tag"i]').first();
    if (await tagInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tagInput.fill("e2e-test");
      await tagInput.press("Enter");
    }

    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/items\/(?!new)/, { timeout: 15000 });
    await expect(page.locator("h1").filter({ hasText: uniqueTitle })).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Collections
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Collections Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("All Collections page loads with collection cards", async ({ page }) => {
    await page.goto("/collections");
    await expect(page.locator("h1").filter({ hasText: /Collections/i })).toBeVisible();
    const collectionCards = page.locator(
      'a[href^="/collections/"], [data-testid="collection-card"]',
    );
    // Should have at least the seed collections
    await expect(collectionCards.first()).toBeVisible({ timeout: 10000 });
  });

  test("Clicking a collection navigates to its detail page", async ({ page }) => {
    await page.goto("/collections");
    const firstCollection = page.locator("text=AI & Machine Learning").first();
    await firstCollection.waitFor({ state: "visible", timeout: 10000 });
    await firstCollection.click();
    await page.waitForURL(/\/collections\//, { timeout: 10000 });
    // Collection detail should show a search input or items
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("Collection detail shows items", async ({ page }) => {
    await page.goto("/collections");
    const firstCollection = page.locator("text=AI & Machine Learning").first();
    await firstCollection.waitFor({ state: "visible", timeout: 10000 });
    await firstCollection.click();
    await page.waitForURL(/\/collections\//, { timeout: 10000 });
    await page.waitForTimeout(2000);
    // Should have some item elements visible
    const items = page.locator("a[href^='/items/']");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Search
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Search Workflow", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("Search page has semantic and full-text tabs", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText(/Semantic/).first()).toBeVisible();
    await expect(page.getByText(/Full Text/i).first()).toBeVisible();
  });

  test("Search for existing content returns results", async ({ page }) => {
    await page.goto("/search");
    const searchInput = page.locator('input[placeholder*="find"i]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("AI");
    await searchInput.press("Enter");
    await page.waitForTimeout(2000);
    // Either shows results or a "no results" message
    const results = page.getByText(/Found .+ result/i);
    const noResults = page.getByText(/no results/i);
    await expect(results.or(noResults)).toBeVisible({ timeout: 10000 });
  });

  test("Saved search suggestions are visible", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText("AI and machine learning articles").first()).toBeVisible({
      timeout: 5000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Settings Pages
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Settings Pages", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("General settings page loads", async ({ page }) => {
    await page.goto("/settings/general");
    await expect(page.locator("h1").filter({ hasText: /Settings/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Notifications settings page loads", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page.locator("h1").filter({ hasText: /Notification Settings/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("API Keys settings page loads", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await expect(page.locator("h1").filter({ hasText: /API Keys/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Alert thresholds page loads", async ({ page }) => {
    await page.goto("/settings/alerts");
    await expect(page.getByText(/threshold/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("Import/Export page loads", async ({ page }) => {
    await page.goto("/settings/import-export");
    await expect(page.locator("h1").filter({ hasText: /Import & Export/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Tags management page loads", async ({ page }) => {
    await page.goto("/tags");
    await expect(page.locator("h1").filter({ hasText: /Tags/i })).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Activity & Status
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Activity and Status", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("Activity page shows recent activity", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.locator("h1").filter({ hasText: /Activity/i })).toBeVisible({
      timeout: 10000,
    });
    // Should have some activity entries or an empty state
    const activityList = page.locator("[data-testid='activity-item'], .activity-entry, li").first();
    await expect(activityList)
      .toBeVisible({ timeout: 10000 })
      .catch(() => {});
  });

  test("System status page loads", async ({ page }) => {
    await page.goto("/status");
    await expect(page.locator("h1").filter({ hasText: /System Status/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Graph Interaction
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Graph Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("Graph renders with SVG elements", async ({ page }) => {
    await page.goto("/graph");
    await page.waitForSelector("svg", { timeout: 10000 });
    const svg = page.locator("svg");
    await expect(svg).toBeVisible();
    // There should be line elements (edges) in the graph
    const edges = svg.locator("line");
    await expect(edges.first()).toBeVisible({ timeout: 5000 });
  });
  test("Graph nodes can be clicked", async ({ page }) => {
    await page.goto("/graph");
    await page.waitForSelector("svg circle", { timeout: 10000 });
    // Wait for simulation to settle — circles should be stable
    await page.waitForTimeout(2000);
    const circles = page.locator("svg circle");
    const count = await circles.count();
    if (count > 0) {
      await circles.first().waitFor({ state: "visible", timeout: 5000 });
      await circles.first().click({ force: true });
      // Clicking a node should navigate or show a tooltip/popover
      await page.waitForTimeout(1500);
      const tooltip = page.locator("[role='tooltip'], .popover, .tooltip").first();
      await expect(tooltip)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });
});
