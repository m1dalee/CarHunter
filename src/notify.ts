import { buildPlainMessage, buildTelegramMessages } from "./message.js";
import type { AppConfig, DeliveryChannel, ListingRecord } from "./types.js";

type NotifyResult = {
  channel: DeliveryChannel;
  delivered: boolean;
  detail: string;
};

async function sendTelegram(messages: string[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID requis");
  }

  for (const text of messages) {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram ${response.status}: ${body}`);
    }
  }
}

async function sendNtfy(message: string, title: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) {
    throw new Error("NTFY_TOPIC requis");
  }

  const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: {
      Title: title,
      Tags: "car,red_car",
      Priority: "default",
    },
    body: message.slice(0, 4000),
  });

  if (!response.ok) {
    throw new Error(`ntfy ${response.status}`);
  }
}

export async function deliverReport(
  config: AppConfig,
  listings: ListingRecord[],
  runAt: Date,
): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];
  const freshCount = listings.filter((listing) => listing.isNew).length;
  const title =
    freshCount > 0
      ? `${freshCount} nouvelle${freshCount > 1 ? "s" : ""} annonce${freshCount > 1 ? "s" : ""}`
      : "Aucune nouvelle annonce";

  const hasTelegram =
    Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) &&
    Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
  const hasNtfy = Boolean(process.env.NTFY_TOPIC?.trim());

  if (hasTelegram) {
    try {
      await sendTelegram(buildTelegramMessages(config, listings, runAt));
      results.push({
        channel: "telegram",
        delivered: true,
        detail: "Message Telegram envoyé",
      });
    } catch (error) {
      results.push({
        channel: "telegram",
        delivered: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (hasNtfy) {
    try {
      await sendNtfy(buildPlainMessage(config, listings, runAt), title);
      results.push({
        channel: "ntfy",
        delivered: true,
        detail: "Notification ntfy envoyée",
      });
    } catch (error) {
      results.push({
        channel: "ntfy",
        delivered: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!hasTelegram && !hasNtfy) {
    const preview = buildPlainMessage(config, listings, runAt);
    console.log("\n--- Aperçu message (aucun canal configuré) ---\n");
    console.log(preview);
    console.log("\n--- Configure TELEGRAM_* ou NTFY_TOPIC dans .env ---\n");
  }

  return results;
}
