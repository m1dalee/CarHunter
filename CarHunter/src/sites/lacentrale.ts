import type { Page } from "playwright";
import type { RawListing, SearchConfig } from "../types.js";
import { absoluteUrl, parseMileage, parsePrice, parseYear } from "../utils.js";

function buildSearchUrl(search: SearchConfig): string {
  const params = new URLSearchParams({
    priceMax: String(search.maxPrice),
    pageNumber: "1",
    makesModelsCommercialNames:
      search.id === "m140i" ? "BMW:M140i" : "BMW:M4",
  });
  return `https://www.lacentrale.fr/listing?${params}`;
}

export async function fetchLaCentrale(
  page: Page,
  search: SearchConfig,
): Promise<RawListing[]> {
  await page.goto(buildSearchUrl(search), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(4_000);

  const cards = page.locator('[data-testid="vehicleCardV2"], .searchCard, article');
  const count = await cards.count();
  const listings: RawListing[] = [];

  for (let index = 0; index < Math.min(count, 25); index++) {
    const card = cards.nth(index);
    const link = card.locator("a").first();
    const href = await link.getAttribute("href");
    if (!href) continue;

    const title =
      (await card.locator("h2, h3, [data-testid='vehicleCardV2-title']").first().textContent())?.trim() ??
      "Annonce La Centrale";
    const priceText =
      (await card.locator("[data-testid='price'], .price, .Price").first().textContent()) ?? "";
    const mileageText =
      (await card.locator(":text-matches('km', 'i')").first().textContent()) ?? "";
    const yearText =
      (await card.locator(":text-matches('20\\\\d{2}|19\\\\d{2}')").first().textContent()) ?? "";

    listings.push({
      site: "lacentrale",
      externalId: href.match(/(\d{5,})/)?.[1] ?? href,
      url: absoluteUrl("https://www.lacentrale.fr", href),
      title,
      price: parsePrice(priceText),
      location: null,
      mileage: parseMileage(mileageText),
      year: parseYear(yearText),
      description: title,
      searchId: search.id,
    });
  }

  return listings;
}
