import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { ListingRecord, RawListing } from "./types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "car-hunter.db");

export function openDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS seen_listings (
      site TEXT NOT NULL,
      external_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER,
      location TEXT,
      mileage INTEGER,
      year INTEGER,
      description TEXT,
      search_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (site, external_id)
    );
  `);
  return db;
}

const upsertStmt = `
  INSERT INTO seen_listings (
    site, external_id, url, title, price, location, mileage, year,
    description, search_id, first_seen_at, last_seen_at
  ) VALUES (
    @site, @externalId, @url, @title, @price, @location, @mileage, @year,
    @description, @searchId, @now, @now
  )
  ON CONFLICT(site, external_id) DO UPDATE SET
    url = excluded.url,
    title = excluded.title,
    price = excluded.price,
    location = excluded.location,
    mileage = excluded.mileage,
    year = excluded.year,
    description = excluded.description,
    search_id = excluded.search_id,
    last_seen_at = excluded.last_seen_at
`;

export function persistListings(
  db: Database.Database,
  listings: RawListing[],
): ListingRecord[] {
  const now = new Date().toISOString();
  const existsStmt = db.prepare(
    "SELECT 1 FROM seen_listings WHERE site = ? AND external_id = ?",
  );
  const insert = db.prepare(upsertStmt);
  const results: ListingRecord[] = [];

  for (const listing of listings) {
    const existed = existsStmt.get(listing.site, listing.externalId);
    insert.run({
      site: listing.site,
      externalId: listing.externalId,
      url: listing.url,
      title: listing.title,
      price: listing.price,
      location: listing.location,
      mileage: listing.mileage,
      year: listing.year,
      description: listing.description,
      searchId: listing.searchId,
      now,
    });

    results.push({
      ...listing,
      firstSeenAt: now,
      isNew: !existed,
    });
  }

  return results;
}
