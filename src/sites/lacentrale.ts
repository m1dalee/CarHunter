import type { Page } from "playwright";
import type { RawListing, SearchConfig } from "../types.js";
import {
  absoluteUrl,
  dismissCookieBanner,
  parseMileage,
  parsePrice,
  parseYear,
} from "../utils.js";

type LcVehicle = {
  make?: string;
  model?: string;
  version?: string;
  year?: number | string;
  mileage?: number | string;
};

type LcHit = {
  item?: {
    price?: number | string;
    classifiedUrl?: string;
    reference?: string | number;
    vehicle?: LcVehicle;
  };
};

function buildSearchUrl(
  search: SearchConfig,
  modelFilter: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    priceMax: String(search.maxPrice),
    pageNumber: "1",
    sortBy: "firstOnlineDateDesc",
    makesModelsCommercialNames: modelFilter,
  });

  for (const [key, value] of Object.entries(extra)) {
    params.set(key, value);
  }

  return `https://www.lacentrale.fr/listing?${params}`;
}

function buildSearchUrls(search: SearchConfig): string[] {
  if (search.id === "m140i") {
    return [buildSearchUrl(search, "BMW:M140i")];
  }

  // La Centrale référence le F82 comme « BMW SERIE 4 F82 M4 », pas « BMW M4 »
  return [
    buildSearchUrl(search, "BMW::SERIE 4 F82 M4"),
    buildSearchUrl(search, "BMW::Série 4 F82 M4"),
    buildSearchUrl(search, "BMW::SERIE 4"),
    buildSearchUrl(search, "BMW::M4", { categories: "COUPE" }),
  ];
}

function listingUrl(item: NonNullable<LcHit["item"]>): string | null {
  if (item.classifiedUrl) {
    return absoluteUrl("https://www.lacentrale.fr", item.classifiedUrl);
  }

  const ref = item.reference ? String(item.reference) : null;
  if (!ref) return null;

  return `https://www.lacentrale.fr/auto-occasion-annonce-${ref}.html`;
}

function mapHit(hit: LcHit, search: SearchConfig): RawListing | null {
  const item = hit.item;
  if (!item) return null;

  const vehicle = item.vehicle ?? {};
  const url = listingUrl(item);
  if (!url) return null;

  const title = [vehicle.make, vehicle.model, vehicle.version]
    .filter(Boolean)
    .join(" ")
    .trim();

  const externalId =
    url.match(/annonce-(\d+)/)?.[1] ??
    (item.reference ? String(item.reference) : url);

  return {
    site: "lacentrale",
    externalId,
    url,
    title: title || "Annonce La Centrale",
    price: parsePrice(item.price),
    location: null,
    mileage: parseMileage(
      typeof vehicle.mileage === "number"
        ? String(vehicle.mileage)
        : vehicle.mileage,
    ),
    year: parseYear(vehicle.year),
    description: title,
    searchId: search.id,
  };
}

function parseSearchResponse(payload: unknown): LcHit[] {
  if (!payload || typeof payload !== "object") return [];

  const hits = (payload as { hits?: LcHit[] }).hits;
  return Array.isArray(hits) ? hits : [];
}

async function scrapeCards(page: Page, search: SearchConfig): Promise<RawListing[]> {
  const cards = page.locator(
    '[data-testid="vehicleCardV2"], [data-testid="searchCard"], .searchCard, article[data-vehicle-id]',
  );
  const count = await cards.count();
  const listings: RawListing[] = [];

  for (let index = 0; index < Math.min(count, 25); index++) {
    const card = cards.nth(index);
    const link = card.locator("a").first();
    const href = await link.getAttribute("href");
    if (!href) continue;

    const title =
      (await card
        .locator("h2, h3, [data-testid='vehicleCardV2-title']")
        .first()
        .textContent())?.trim() ?? "Annonce La Centrale";
    const priceText =
      (await card
        .locator("[data-testid='price'], .price, .Price")
        .first()
        .textContent()) ?? "";
    const mileageText =
      (await card.locator(":text-matches('km', 'i')").first().textContent()) ??
      "";
    const yearText =
      (await card
        .locator(":text-matches('20\\\\d{2}|19\\\\d{2}')")
        .first()
        .textContent()) ?? "";

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

async function loadSearchPage(
  page: Page,
  url: string,
): Promise<LcHit[]> {
  const hits: LcHit[] = [];

  const onResponse = async (response: import("playwright").Response) => {
    if (!response.url().includes("recherche.lacentrale.fr/v3/search")) return;
    if (!response.ok()) return;
    try {
      hits.push(...parseSearchResponse(await response.json()));
    } catch {
      // ignore
    }
  };

  page.on("response", onResponse);

  try {
    const apiResponse = page
      .waitForResponse(
        (response) =>
          response.url().includes("recherche.lacentrale.fr/v3/search") &&
          response.ok(),
        { timeout: 20_000 },
      )
      .catch(() => null);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await dismissCookieBanner(page);
    await apiResponse;
    await page.waitForTimeout(2_000);

    return hits;
  } finally {
    page.off("response", onResponse);
  }
}

export async function fetchLaCentrale(
  page: Page,
  search: SearchConfig,
): Promise<RawListing[]> {
  const urls = buildSearchUrls(search);

  for (const url of urls) {
    const hits = await loadSearchPage(page, url);
    const fromApi = hits
      .map((hit) => mapHit(hit, search))
      .filter((item): item is RawListing => item != null);

    if (fromApi.length > 0) {
      console.log(`[lacentrale] URL OK: ${url}`);
      return fromApi;
    }

    const fromDom = await scrapeCards(page, search);
    if (fromDom.length > 0) {
      console.log(`[lacentrale] URL OK (DOM): ${url}`);
      return fromDom;
    }
  }

  console.log(`[lacentrale] Aucun résultat (${urls.length} URL(s) testées)`);
  return [];
}
