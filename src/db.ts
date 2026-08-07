import fs from "node:fs";
import path from "node:path";
import type { ListingRecord, RawListing } from "./types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_PATH = path.join(DATA_DIR, "seen.json");

type SeenEntry = RawListing & {
  firstSeenAt: string;
  lastSeenAt: string;
};

type SeenStore = Record<string, SeenEntry>;

function listingKey(listing: RawListing): string {
  return `${listing.site}:${listing.externalId}`;
}

function loadSeen(): SeenStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SEEN_PATH)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(SEEN_PATH, "utf8")) as SeenStore;
}

function saveSeen(seen: SeenStore): void {
  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2));
}

export function persistListings(listings: RawListing[]): ListingRecord[] {
  const seen = loadSeen();
  const now = new Date().toISOString();
  const results: ListingRecord[] = [];

  for (const listing of listings) {
    const key = listingKey(listing);
    const existed = Boolean(seen[key]);

    seen[key] = {
      ...listing,
      firstSeenAt: seen[key]?.firstSeenAt ?? now,
      lastSeenAt: now,
    };

    results.push({
      ...listing,
      firstSeenAt: seen[key].firstSeenAt,
      isNew: !existed,
    });
  }

  saveSeen(seen);
  return results;
}
