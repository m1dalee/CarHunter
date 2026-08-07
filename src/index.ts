import configJson from "../config.json" with { type: "json" };
import { persistListings } from "./db.js";
import { loadEnv } from "./env.js";
import { assignSearch, matchesSearch } from "./filter.js";
import { deliverReport } from "./notify.js";
import { fetchAutoScout24 } from "./sites/autoscout24.js";
import type { AppConfig, RawListing, SiteId } from "./types.js";

const config = configJson as AppConfig;

loadEnv();

function activeSites(): AppConfig["sites"] {
  if (process.env.GITHUB_ACTIONS) {
    return config.sites.filter((site) => site === "autoscout24");
  }
  return config.sites;
}

async function collectFromBrowserSites(
  searches: AppConfig["searches"],
  sites: SiteId[],
): Promise<RawListing[]> {
  const browserSites = sites.filter(
    (site) => site !== "autoscout24",
  ) as Exclude<SiteId, "autoscout24">[];

  if (browserSites.length === 0) {
    return [];
  }

  const { collectFromBrowserSitesImpl } = await import("./browser-runner.js");
  return collectFromBrowserSitesImpl(searches, browserSites, config);
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

  const sites = activeSites();
  if (process.env.GITHUB_ACTIONS) {
    console.log("Mode GitHub Actions : AutoScout24 uniquement");
  }

  const raw: RawListing[] = [];
  if (sites.includes("autoscout24")) {
    raw.push(...(await collectFromAutoScout24(config.searches)));
  }
  raw.push(...(await collectFromBrowserSites(config.searches, sites)));

  const matched = dedupe(raw).flatMap((listing) => {
    const search = assignSearch(listing, config);
    if (!search) return [];
    return [{ ...listing, searchId: search.id }];
  });

  const stored = persistListings(matched);
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
