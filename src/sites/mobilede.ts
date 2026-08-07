import type { Page } from "playwright";
import type { RawListing, SearchConfig } from "../types.js";
import { absoluteUrl, parseMileage, parsePrice, parseYear } from "../utils.js";

function buildSearchUrl(search: SearchConfig): string {
  const slug = search.id === "m140i" ? "bmw-m140i" : "bmw-m4";
  const params = new URLSearchParams({
    maxPrice: String(search.maxPrice),
    scopeId: "C",
    sorting: "CREATED_DATE_DESC",
  });
  return `https://suchen.mobile.de/auto/${slug}.html?${params}`;
}

export async function fetchMobileDe(
  page: Page,
  search: SearchConfig,
): Promise<RawListing[]> {
  await page.goto(buildSearchUrl(search), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(4_000);

  const cards = page.locator('[data-testid="result-listing"], .cBox-body--resultitem, article');
  const count = await cards.count();
  const listings: RawListing[] = [];

  for (let index = 0; index < Math.min(count, 25); index++) {
    const card = cards.nth(index);
    const link = card.locator("a").first();
    const href = await link.getAttribute("href");
    if (!href) continue;

    const title =
      (await card.locator('[data-testid="result-listing-title"], h2, h3').first().textContent())?.trim() ??
      "Annonce mobile.de";
    const priceText =
      (await card.locator('[data-testid="result-listing-price"], .price, .h3').first().textContent()) ?? "";
    const details =
      (await card.locator('[data-testid="result-listing-details"]').first().textContent()) ?? "";

    listings.push({
      site: "mobilede",
      externalId: href.match(/id=(\d+)/)?.[1] ?? href.match(/(\d{5,})/)?.[1] ?? href,
      url: absoluteUrl("https://www.mobile.de", href),
      title,
      price: parsePrice(priceText),
      location: null,
      mileage: parseMileage(details),
      year: parseYear(details),
      description: `${title} ${details}`.trim(),
      searchId: search.id,
    });
  }

  return listings;
}
