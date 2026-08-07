import { chromium, type BrowserContext } from "playwright";
import type { AppConfig, RawListing, SiteId } from "./types.js";
import { matchesSearch } from "./filter.js";
import { fetchLaCentrale } from "./sites/lacentrale.js";
import { fetchLeboncoin } from "./sites/leboncoin.js";
import { fetchMobileDe } from "./sites/mobilede.js";
import { BROWSER_HEADERS } from "./utils.js";

const CHROMIUM_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-dev-shm-usage",
];

async function openBrowserContext(): Promise<{
  context: BrowserContext;
  close: () => Promise<void>;
}> {
  const profileDir = process.env.BROWSER_PROFILE_DIR?.trim();

  if (profileDir) {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      locale: "fr-FR",
      userAgent: BROWSER_HEADERS["User-Agent"],
      args: CHROMIUM_ARGS,
    });
    return { context, close: () => context.close() };
  }

  const browser = await chromium.launch({
    headless: true,
    args: CHROMIUM_ARGS,
  });
  const context = await browser.newContext({
    locale: "fr-FR",
    userAgent: BROWSER_HEADERS["User-Agent"],
    extraHTTPHeaders: {
      "Accept-Language": BROWSER_HEADERS["Accept-Language"],
    },
    viewport: { width: 1366, height: 900 },
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
          if (batch.length === 0) {
            console.log(
              `[${site}] ${search.label}: page="${await page.title()}" url=${page.url()}`,
            );
          }
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
