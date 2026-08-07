export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9,de-DE;q=0.8,de;q=0.7",
};

export function parsePrice(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export function parseMileage(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

export function parseYear(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

export function absoluteUrl(base: string, href: string): string {
  return href.startsWith("http") ? href : new URL(href, base).toString();
}

export function formatPrice(price: number | null): string {
  if (price == null) return "Prix non indiqué";
  return `${price.toLocaleString("fr-FR")} €`;
}

export function formatMileage(mileage: number | null): string {
  if (mileage == null) return "Km non indiqué";
  return `${mileage.toLocaleString("fr-FR")} km`;
}

export function siteLabel(site: string): string {
  switch (site) {
    case "autoscout24":
      return "AutoScout24";
    case "leboncoin":
      return "leboncoin";
    case "lacentrale":
      return "La Centrale";
    case "mobilede":
      return "mobile.de";
    default:
      return site;
  }
}
