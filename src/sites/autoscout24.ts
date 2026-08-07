import type { SearchConfig } from "../types.js";
import type { RawListing } from "../types.js";
import { BROWSER_HEADERS, absoluteUrl, parseYear } from "../utils.js";

type Market = "fr" | "de";

type As24Listing = {
  id: string;
  url: string;
  price?: { priceRaw?: number };
  vehicle?: {
    make?: string;
    model?: string;
    motorTypeName?: string;
    modelVersionInput?: string;
    modelGroup?: string;
    mileageInKmRaw?: number;
    firstRegistrationDateRaw?: string;
    location?: { city?: string; countryCode?: string };
  };
};

const MARKETS: Market[] = ["fr", "de"];

function marketBase(market: Market): string {
  return market === "de"
    ? "https://www.autoscout24.de"
    : "https://www.autoscout24.fr";
}

function buildUrl(search: SearchConfig, market: Market): string {
  const params = new URLSearchParams({
    priceto: String(search.maxPrice),
    size: "20",
    page: "1",
  });

  const base = marketBase(market);

  if (search.id === "m140i") {
    params.set("version0", "bmw|m140i");
    return `${base}/lst/bmw?${params}`;
  }

  return `${base}/lst/bmw/m4?${params}`;
}

function toListing(
  item: As24Listing,
  search: SearchConfig,
  market: Market,
): RawListing | null {
  if (!item?.id || !item?.url) return null;

  const vehicle = item.vehicle ?? {};
  const base = marketBase(market);
  const title = [
    vehicle.make,
    vehicle.modelGroup ?? vehicle.model,
    vehicle.motorTypeName ?? vehicle.modelVersionInput,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    site: "autoscout24",
    externalId: `${market}:${item.id}`,
    url: absoluteUrl(base, item.url),
    title: title || vehicle.modelVersionInput || "Annonce AutoScout24",
    price: item.price?.priceRaw ?? null,
    location: [vehicle.location?.city, vehicle.location?.countryCode]
      .filter(Boolean)
      .join(", ") || null,
    mileage: vehicle.mileageInKmRaw ?? null,
    year: parseYear(vehicle.firstRegistrationDateRaw),
    description: vehicle.modelVersionInput ?? null,
    searchId: search.id,
  };
}

async function fetchMarket(
  search: SearchConfig,
  market: Market,
): Promise<RawListing[]> {
  const url = buildUrl(search, market);
  const response = await fetch(url, { headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`AutoScout24 ${market.toUpperCase()} ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error(`AutoScout24 ${market.toUpperCase()}: page illisible`);
  }

  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: { listings?: As24Listing[] } };
  };

  return (data.props?.pageProps?.listings ?? [])
    .map((item) => toListing(item, search, market))
    .filter((item): item is RawListing => item != null);
}

export async function fetchAutoScout24(
  search: SearchConfig,
): Promise<RawListing[]> {
  const batches = await Promise.all(
    MARKETS.map(async (market) => {
      try {
        return await fetchMarket(search, market);
      } catch (error) {
        console.error(
          `[autoscout24:${market}] ${search.label}:`,
          error instanceof Error ? error.message : error,
        );
        return [];
      }
    }),
  );

  return batches.flat();
}
