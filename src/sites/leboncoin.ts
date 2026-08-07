import type { Page } from "playwright";
import type { RawListing, SearchConfig } from "../types.js";
import { absoluteUrl, parseMileage, parsePrice, parseYear } from "../utils.js";

type LbcAd = {
  list_id?: number;
  subject?: string;
  body?: string;
  price?: number[];
  url?: string;
  location?: { city?: string; region_name?: string };
  attributes?: Array<{ key?: string; value_label?: string }>;
};

function buildSearchUrl(search: SearchConfig): string {
  const params = new URLSearchParams({
    category: "2",
    sort: "time",
    order: "desc",
    price: `0-${search.maxPrice}`,
    text: search.id === "m140i" ? "BMW M140i" : "BMW M4 F82",
  });
  return `https://www.leboncoin.fr/recherche?${params}`;
}

function readAttribute(ad: LbcAd, key: string): string | undefined {
  return ad.attributes?.find((item) => item.key === key)?.value_label;
}

function mapAd(ad: LbcAd, search: SearchConfig): RawListing | null {
  const id = ad.list_id ? String(ad.list_id) : null;
  if (!id) return null;

  const url = ad.url
    ? absoluteUrl("https://www.leboncoin.fr", ad.url)
    : `https://www.leboncoin.fr/ad/voitures/${id}`;

  return {
    site: "leboncoin",
    externalId: id,
    url,
    title: ad.subject ?? "Annonce leboncoin",
    price: ad.price?.[0] ?? null,
    location: [ad.location?.city, ad.location?.region_name]
      .filter(Boolean)
      .join(", ") || null,
    mileage: parseMileage(readAttribute(ad, "mileage")),
    year: parseYear(readAttribute(ad, "regdate")),
    description: ad.body ?? null,
    searchId: search.id,
  };
}

export async function fetchLeboncoin(
  page: Page,
  search: SearchConfig,
): Promise<RawListing[]> {
  const ads: LbcAd[] = [];

  page.on("response", async (response) => {
    if (!response.url().includes("api.leboncoin.fr/finder/search")) return;
    try {
      const json = (await response.json()) as { ads?: LbcAd[] };
      if (json.ads?.length) ads.push(...json.ads);
    } catch {
      // ignore
    }
  });

  await page.goto(buildSearchUrl(search), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(4_000);

  if (ads.length === 0) {
    const cards = await page.locator('[data-qa-id="aditem_container"]').all();
    for (const card of cards.slice(0, 20)) {
      const title = (await card.locator("p").first().textContent())?.trim() ?? "";
      const href = await card.locator("a").first().getAttribute("href");
      const priceText =
        (await card.locator('[data-qa-id="aditem_price"]').textContent()) ?? "";
      if (!href) continue;
      const externalId = href.match(/(\d+)/)?.[1];
      if (!externalId) continue;
      ads.push({
        list_id: Number(externalId),
        subject: title,
        url: href,
        price: [parsePrice(priceText) ?? 0],
      });
    }
  }

  return ads
    .map((ad) => mapAd(ad, search))
    .filter((item): item is RawListing => item != null);
}
