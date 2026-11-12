import { COUNTRY_CODES, type Industry, type OrgSize, type OrgType } from "@nexora/shared";

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  product: "Product company",
  service: "Service company",
  both: "Product and service",
};

export const ORG_SIZE_LABELS: Record<OrgSize, string> = {
  "1-10": "1–10 people",
  "11-50": "11–50 people",
  "51-200": "51–200 people",
  "201-500": "201–500 people",
  "500+": "500+ people",
};

export const INDUSTRY_LABELS: Record<Industry, string> = {
  it_services: "IT services",
  software_product: "Software product",
  fintech: "Fintech",
  healthtech: "Healthtech",
  edtech: "Edtech",
  ecommerce_retail: "E-commerce and retail",
  media_entertainment: "Media and entertainment",
  manufacturing: "Manufacturing",
  consulting: "Consulting",
  other: "Other",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countryName = (code: string): string => regionNames.of(code) ?? code;

// Sorted by display name for the country picker.
export const COUNTRY_OPTIONS = COUNTRY_CODES.map((code) => ({
  code,
  name: countryName(code),
})).sort((a, b) => a.name.localeCompare(b.name));

export const browserTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

// IANA names the browser knows, plus the browser's own (it may be an alias not in the list).
export const timezoneOptions = (current?: string): string[] => {
  const zones = Intl.supportedValuesOf("timeZone");
  const extra = [current, browserTimezone()].filter(
    (z): z is string => Boolean(z) && !zones.includes(z!),
  );
  return [...new Set([...extra, ...zones])];
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
