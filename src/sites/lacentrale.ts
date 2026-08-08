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
    return [buildSearchUrl(search, "BMW::SERIE 1", { versions: "140i" })];
  }

  return [buildSearchUrl(search, "BMW::SERIE 4", { versions: "(f82)" })];
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

  const modelLine = [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim();
  const version = vehicle.version?.trim() ?? "";
  const title = [modelLine, version].filter(Boolean).join(" ").trim();
  const description = [modelLine, version].filter(Boolean).join(" | ");

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
    description: description || title,
    searchId: search.id,
  };
}

function parseSearchResponse(payload: unknown): LcHit[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as { hits?: LcHit[]; data?: { hits?: LcHit[] } };
  const hits = root.hits ?? root.data?.hits;
  return Array.isArray(hits) ? hits : [];
}

type DomCard = {
  href: string;
  title: string;
  version: string;
  cardText: string;
};

function isSearchApiUrl(url: string): boolean {
  return (
    url.includes("recherche.lacentrale.fr") &&
    (url.includes("/v3/search") || url.includes("/search"))
  );
}

async function scrapeCards(page: Page, search: SearchConfig): Promise<RawListing[]> {
  await page
    .locator(
      '[data-testid="vehicleCardV2"], [data-testid="searchCard"], article[data-vehicle-id]',
    )
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => undefined);

  const raw = await page.evaluate((): Array<DomCard | null> => {
    const selector =
      '[data-testid="vehicleCardV2"], [data-testid="searchCard"], .searchCard, article[data-vehicle-id]';
    return Array.from(document.querySelectorAll(selector))
      .slice(0, 25)
      .map((card) => {
        const link =
          card.querySelector<HTMLAnchorElement>('a[href*="annonce"]') ??
          card.querySelector<HTMLAnchorElement>('a[href*="/auto-"]') ??
          card.querySelector<HTMLAnchorElement>("a[href]");
        const href = link?.getAttribute("href")?.trim() ?? "";
        if (!href || href === "#") return null;

        const title =
          card
            .querySelector("h2, h3, [data-testid='vehicleCardV2-title']")
            ?.textContent?.trim() ?? "";
        const version =
          card
            .querySelector(
              "[data-testid='vehicleCardV2-version'], [data-testid='vehicleCardV2-subtitle'], .vehicleVersion",
            )
            ?.textContent?.trim() ?? "";

        return {
          href,
          title,
          version,
          cardText: card.textContent ?? "",
        };
      });
  });

  const listings: RawListing[] = [];

  for (const item of raw) {
    if (!item) continue;

    const title = item.title || "Annonce La Centrale";
    let priceText = item.cardText.match(/(\d[\d\s\u00a0.]*)\s*€/)?.[0] ?? "";
    const mileageText = item.cardText.match(/\d[\d\s\u00a0.]*\s*km/i)?.[0] ?? "";
    const yearText = item.cardText.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";

    listings.push({
      site: "lacentrale",
      externalId: item.href.match(/(\d{5,})/)?.[1] ?? item.href,
      url: absoluteUrl("https://www.lacentrale.fr", item.href),
      title: [title, item.version].filter(Boolean).join(" "),
      price: parsePrice(priceText),
      location: null,
      mileage: parseMileage(mileageText),
      year: parseYear(yearText),
      description: [title, item.version].filter(Boolean).join(" | "),
      searchId: search.id,
    });
  }

  return listings;
}

async function loadSearchPage(page: Page, url: string): Promise<LcHit[]> {
  const hits: LcHit[] = [];

  const onResponse = async (response: import("playwright").Response) => {
    if (!isSearchApiUrl(response.url())) return;
    if (!response.ok()) return;
    try {
      const batch = parseSearchResponse(await response.json());
      if (batch.length > 0) {
        hits.push(...batch);
      }
    } catch {
      // ignore
    }
  };

  page.on("response", onResponse);

  try {
    const apiResponse = page
      .waitForResponse(
        (response) => isSearchApiUrl(response.url()) && response.ok(),
        { timeout: 25_000 },
      )
      .catch(() => null);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await dismissCookieBanner(page);
    await apiResponse;
    await page.waitForTimeout(3_000);

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
    try {
      const hits = await loadSearchPage(page, url);
      const fromApi = hits
        .map((hit) => mapHit(hit, search))
        .filter((item): item is RawListing => item != null);

      if (fromApi.length > 0) {
        console.log(`[lacentrale] API ${fromApi.length} annonce(s) — ${url}`);
        return fromApi;
      }

      if (hits.length > 0) {
        console.log(
          `[lacentrale] API ${hits.length} hit(s) non mappable(s), fallback DOM — ${url}`,
        );
      } else {
        console.log(`[lacentrale] API vide, fallback DOM — ${url}`);
      }

      const fromDom = await scrapeCards(page, search);
      if (fromDom.length > 0) {
        console.log(`[lacentrale] DOM ${fromDom.length} annonce(s) — ${url}`);
        return fromDom;
      }
    } catch (error) {
      console.error(
        `[lacentrale] ${search.label}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`[lacentrale] Aucun résultat (${urls.length} URL(s) testées)`);
  return [];
}
