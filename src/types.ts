export type SiteId = "autoscout24" | "leboncoin" | "lacentrale" | "mobilede";

export type SearchConfig = {
  id: string;
  label: string;
  maxPrice: number;
  mustInclude: string[];
  mustExclude: string[];
};

export type AppConfig = {
  excludeKeywords: string[];
  searches: SearchConfig[];
  sites: SiteId[];
};

export type RawListing = {
  site: SiteId;
  externalId: string;
  url: string;
  title: string;
  price: number | null;
  location: string | null;
  mileage: number | null;
  year: number | null;
  description: string | null;
  searchId: string;
};

export type ListingRecord = RawListing & {
  firstSeenAt: string;
  isNew: boolean;
};

export type DeliveryChannel = "telegram" | "ntfy";
