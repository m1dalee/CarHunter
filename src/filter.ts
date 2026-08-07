import type { AppConfig, RawListing, SearchConfig } from "./types.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function haystack(listing: RawListing): string {
  return normalize(
    [listing.title, listing.description ?? "", listing.url].join(" "),
  );
}

export function matchesSearch(
  listing: RawListing,
  search: SearchConfig,
  config: AppConfig,
): boolean {
  if (listing.price != null && listing.price > search.maxPrice) {
    return false;
  }

  const text = haystack(listing);
  const excludes = [...config.excludeKeywords, ...search.mustExclude];

  for (const keyword of excludes) {
    if (text.includes(normalize(keyword))) {
      return false;
    }
  }

  for (const keyword of search.mustInclude) {
    if (!text.includes(normalize(keyword))) {
      return false;
    }
  }

  return true;
}

export function assignSearch(
  listing: RawListing,
  config: AppConfig,
): SearchConfig | null {
  for (const search of config.searches) {
    if (matchesSearch(listing, search, config)) {
      return search;
    }
  }
  return null;
}
