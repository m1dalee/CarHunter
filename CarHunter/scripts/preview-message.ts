import configJson from "../config.json" with { type: "json" };
import { buildPlainMessage, buildTelegramMessages } from "../src/message.js";
import type { AppConfig, ListingRecord } from "../src/types.js";

const config = configJson as AppConfig;
const runAt = new Date();

const sample: ListingRecord[] = [
  {
    site: "autoscout24",
    externalId: "fr:demo-1",
    url: "https://www.autoscout24.fr/offres/demo-m140i",
    title: "BMW Série 1 M140i",
    price: 27500,
    location: "Lyon, FR",
    mileage: 62000,
    year: 2018,
    description: "M140i automatique",
    searchId: "m140i",
    firstSeenAt: runAt.toISOString(),
    isNew: true,
  },
  {
    site: "autoscout24",
    externalId: "de:demo-2",
    url: "https://www.autoscout24.de/angebote/demo-m4",
    title: "BMW M4 Coupé",
    price: 38900,
    location: "München, DE",
    mileage: 78000,
    year: 2017,
    description: "M4 F82",
    searchId: "m4-f82",
    firstSeenAt: runAt.toISOString(),
    isNew: true,
  },
];

console.log("=== TELEGRAM ===\n");
for (const message of buildTelegramMessages(config, sample, runAt)) {
  console.log(message);
  console.log("\n---\n");
}

console.log("=== NTFY / PLAIN ===\n");
console.log(buildPlainMessage(config, sample, runAt));
