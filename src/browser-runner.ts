import { chromium, type BrowserContext } from "playwright";
import type { AppConfig, RawListing, SiteId } from "./types.js";
import { matchesSearch } from "./filter.js";
import { fetchLaCentrale } from "./sites/lacentrale.js";
import { fetchLeboncoin } from "./sites/leboncoin.js";
import { fetchMobileDe } from "./sites/mobilede.js";

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

export async function collectFromBrowserSitesImpl(
  searches: AppConfig["searches"],
  browserSites: Exclude<SiteId, "autoscout24">[],
  config: AppConfig,
): Promise<RawListing[]> {
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
