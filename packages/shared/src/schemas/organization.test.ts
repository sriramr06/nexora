import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, isValidTimezone, organizationDetailsSchema } from "./organization";

const valid = {
  name: "  Acme Corp ",
  type: "product",
  size: "11-50",
  industry: "software_product",
  country: "IN",
  timezone: "Asia/Kolkata",
  website: "",
  description: "",
};

describe("organizationDetailsSchema", () => {
  it("accepts a valid registration and normalises optional fields", () => {
    const parsed = organizationDetailsSchema.parse(valid);
    expect(parsed).toMatchObject({ name: "Acme Corp", country: "IN" });
    expect(parsed.website).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("rejects unknown enum values, country and timezone", () => {
    const result = organizationDetailsSchema.safeParse({
      ...valid,
      type: "agency",
      country: "XX",
      timezone: "Mars/Olympus",
    });
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["type", "country", "timezone"]));
  });

  it("requires http(s) websites", () => {
    expect(organizationDetailsSchema.safeParse({ ...valid, website: "acme.com" }).success).toBe(
      false,
    );
    expect(
      organizationDetailsSchema.safeParse({ ...valid, website: "https://acme.com" }).success,
    ).toBe(true);
  });
});

describe("reference data", () => {
  it("has the 249 ISO 3166-1 countries, unique", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
  });

  it("accepts browser timezone aliases", () => {
    expect(isValidTimezone("Asia/Calcutta")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Nowhere/Land")).toBe(false);
  });
});
