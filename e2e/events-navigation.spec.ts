import { test, expect } from "@playwright/test";

test.describe("Event Explorer cross-route navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  });

  test("navigates from /events to /sponsors via sidebar", async ({ page }) => {
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", {
      name: "Sponsors",
      exact: true,
    }).click();

    await expect(page).toHaveURL(/\/sponsors$/);
    await expect(page.getByRole("heading", { name: "Sponsors", level: 1 })).toBeVisible();
  });

  test("navigates from /events to event detail via result card", async ({ page }) => {
    const firstEventCard = page.locator('a[aria-label^="View "]').first();
    await expect(firstEventCard).toBeVisible();

    const href = await firstEventCard.getAttribute("href");
    assertEventDetailHref(href);

    await firstEventCard.click();

    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href!)}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

function assertEventDetailHref(href: string | null): asserts href is string {
  if (href === null || !href.startsWith("/events/") || href === "/events") {
    throw new Error(`Expected event detail href, received: ${href}`);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
