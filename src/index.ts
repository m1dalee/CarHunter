import { chromium, type BrowserContext } from "playwright";
import configJson from "../config.json" with { type: "json" };
import { openDb, persistListings } from "./db.js";
import { loadEnv } from "./env.js";
import { assignSearch, matchesSearch } from "./filter.js";
import { deliverReport } from "./notify.js";
import { fetchAutoScout24 } from "./sites/autoscout24.js";
import { fetchLaCentrale } from "./sites/lacentrale.js";
import { fetchLeboncoin } from "./sites/leboncoin.js";
import { fetchMobileDe } from "./sites/mobilede.js";
import type { AppConfig, RawListing, SiteId } from "./types.js";

const config = configJson as AppConfig;

loadEnv();

async function openBrowserContext(): Promise<{
  context: BrowserContext;
  close: () => Promise<void>;
}> {
  const profileDir = process.env.BROWSER_PROFILE_DIR?.trim();

  if (profileDir) {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      locale: "fr-FR",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    return { context, close: () => context.close() };
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "fr-FR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  return {
    context,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}

async function collectFromBrowserSites(
  searches: AppConfig["searches"],
  sites: SiteId[],
): Promise<RawListing[]> {
  const browserSites = sites.filter(
    (site) => site !== "autoscout24",
  ) as Exclude<SiteId, "autoscout24">[];

  if (browserSites.length === 0) return [];

  const browser = await openBrowserContext();
  const page = await browser.context.newPage();
  const collected: RawListing[] = [];

  try {
    for (const search of searches) {
      for (const site of browserSites) {
        try {
          let batch: RawListing[] = [];
          if (site === "leboncoin") batch = await fetchLeboncoin(page, search);
          if (site === "lacentrale") batch = await fetchLaCentrale(page, search);
          if (site === "mobilede") batch = await fetchMobileDe(page, search);

          const filtered = batch.filter((listing) =>
            matchesSearch(listing, search, config),
          );
          collected.push(...filtered);
          console.log(
            `[${site}] ${search.label}: ${filtered.length}/${batch.length} annonce(s)`,
          );
        } catch (error) {
          console.error(
            `[${site}] ${search.label}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  } finally {
    await browser.close();
  }

  return collected;
}

async function collectFromAutoScout24(
  searches: AppConfig["searches"],
): Promise<RawListing[]> {
  const collected: RawListing[] = [];

  for (const search of searches) {
    try {
      const batch = await fetchAutoScout24(search);
      const filtered = batch.filter((listing) =>
        matchesSearch(listing, search, config),
      );
      collected.push(...filtered);
      console.log(
        `[autoscout24] ${search.label}: ${filtered.length}/${batch.length} annonce(s)`,
      );
    } catch (error) {
      console.error(
        `[autoscout24] ${search.label}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return collected;
}

function dedupe(listings: RawListing[]): RawListing[] {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key = `${listing.site}:${listing.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main(): Promise<void> {
  const runAt = new Date();
  console.log(`Car Hunter — ${runAt.toLocaleString("fr-FR")}`);

  const raw: RawListing[] = [];
  if (config.sites.includes("autoscout24")) {
    raw.push(...(await collectFromAutoScout24(config.searches)));
  }
  raw.push(...(await collectFromBrowserSites(config.searches, config.sites)));

  const matched = dedupe(raw).flatMap((listing) => {
    const search = assignSearch(listing, config);
    if (!search) return [];
    return [{ ...listing, searchId: search.id }];
  });

  const db = openDb();
  const stored = persistListings(db, matched);
  db.close();

  const delivery = await deliverReport(config, stored, runAt);
  const freshCount = stored.filter((listing) => listing.isNew).length;

  console.log(`${freshCount} nouvelle(s), ${stored.length} au total ce run`);
  for (const result of delivery) {
    console.log(
      `[${result.channel}] ${result.delivered ? "OK" : "ERREUR"} — ${result.detail}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
