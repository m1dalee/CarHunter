import type { AppConfig, ListingRecord } from "./types.js";
import {
  formatMileage,
  formatPrice,
  siteLabel,
} from "./utils.js";

function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatRunDate(date: Date): string {
  return date.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderListingTelegram(listing: ListingRecord): string {
  const badge = listing.isNew ? "🆕 " : "";
  const year = listing.year ? `${listing.year}` : "Année ?";

  return [
    `${badge}<b>${escapeTelegramHtml(listing.title)}</b>`,
    `💰 ${formatPrice(listing.price)} · 📍 ${escapeTelegramHtml(listing.location ?? "Lieu non indiqué")}`,
    `🛣 ${formatMileage(listing.mileage)} · 📅 ${year}`,
    `🏷 ${escapeTelegramHtml(siteLabel(listing.site))}`,
    `<a href="${listing.url}">👉 Voir l'annonce</a>`,
  ].join("\n");
}

function renderListingPlain(listing: ListingRecord): string {
  const badge = listing.isNew ? "🆕 " : "";
  const year = listing.year ? `${listing.year}` : "Année ?";

  return [
    `${badge}${listing.title}`,
    `💰 ${formatPrice(listing.price)} · 📍 ${listing.location ?? "Lieu non indiqué"}`,
    `🛣 ${formatMileage(listing.mileage)} · 📅 ${year}`,
    `🏷 ${siteLabel(listing.site)}`,
    `🔗 ${listing.url}`,
  ].join("\n");
}

export function buildTelegramMessages(
  config: AppConfig,
  listings: ListingRecord[],
  runAt: Date,
): string[] {
  const fresh = listings.filter((listing) => listing.isNew);

  if (fresh.length === 0) {
    return [
      [
        "🚗 <b>Car Hunter</b>",
        `🕐 ${formatRunDate(runAt)}`,
        "",
        "😴 Aucune nouvelle annonce pour tes critères.",
        "",
        `<i>Recherches actives : ${config.searches.map((s) => s.label).join(" · ")}</i>`,
      ].join("\n"),
    ];
  }

  const chunks: string[] = [];
  let current = [
    "🚗 <b>Car Hunter</b>",
    `🕐 ${formatRunDate(runAt)}`,
    "",
    `✨ <b>${fresh.length} nouvelle${fresh.length > 1 ? "s" : ""} annonce${fresh.length > 1 ? "s" : ""}</b>`,
    "",
  ].join("\n");

  for (const search of config.searches) {
    const group = fresh.filter((listing) => listing.searchId === search.id);
    if (group.length === 0) continue;

    const sectionHeader = `\n━━ <b>${escapeTelegramHtml(search.label)}</b> (${group.length}) ━━\n\n`;
    let section = sectionHeader;

    for (const listing of group) {
      const block = `${renderListingTelegram(listing)}\n\n`;
      if ((current + section + block).length > 3800) {
        chunks.push(current + section);
        current = `🚗 <b>Car Hunter</b> (suite)\n\n`;
        section = sectionHeader;
      }
      section += block;
    }

    current += section;
  }

  chunks.push(current.trim());
  return chunks;
}

export function buildPlainMessage(
  config: AppConfig,
  listings: ListingRecord[],
  runAt: Date,
): string {
  const fresh = listings.filter((listing) => listing.isNew);

  if (fresh.length === 0) {
    return [
      "🚗 Car Hunter",
      `🕐 ${formatRunDate(runAt)}`,
      "",
      "😴 Aucune nouvelle annonce pour tes critères.",
      "",
      `Recherches actives : ${config.searches.map((s) => s.label).join(" · ")}`,
    ].join("\n");
  }

  const lines = [
    "🚗 Car Hunter",
    `🕐 ${formatRunDate(runAt)}`,
    "",
    `✨ ${fresh.length} nouvelle${fresh.length > 1 ? "s" : ""} annonce${fresh.length > 1 ? "s" : ""}`,
    "",
  ];

  for (const search of config.searches) {
    const group = fresh.filter((listing) => listing.searchId === search.id);
    if (group.length === 0) continue;

    lines.push(`━━ ${search.label} (${group.length}) ━━`, "");
    for (const listing of group) {
      lines.push(renderListingPlain(listing), "");
    }
  }

  return lines.join("\n").trim();
}
