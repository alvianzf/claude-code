import { describe, it, expect } from "vitest";
import { slugify, validateTenantSlug, validateTenantStatus, validateTenantName } from "./validation.js";
import { ApiError } from "./ApiError.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Corp", new Set())).toBe("acme-corp");
  });

  it("strips leading/trailing and collapses non-alphanumeric runs", () => {
    expect(slugify("  Hello, World!! ", new Set())).toBe("hello-world");
  });

  it("auto-dedupes against existing slugs by appending -2, -3, ...", () => {
    const existing = new Set(["acme-corp", "acme-corp-2"]);
    expect(slugify("Acme Corp", existing)).toBe("acme-corp-3");
  });

  it("pads short names to meet the 3-char minimum", () => {
    const slug = slugify("AB", new Set());
    expect(slug.length).toBeGreaterThanOrEqual(3);
    expect(validateTenantSlug(slug)).toBe(slug);
  });
});

describe("validateTenantSlug", () => {
  it("accepts valid slugs", () => {
    expect(validateTenantSlug("default")).toBe("default");
    expect(validateTenantSlug("acme-corp-2")).toBe("acme-corp-2");
  });

  it("rejects uppercase, too-short, or invalid characters", () => {
    expect(() => validateTenantSlug("Acme")).toThrow(ApiError);
    expect(() => validateTenantSlug("ab")).toThrow(ApiError);
    expect(() => validateTenantSlug("acme_corp")).toThrow(ApiError);
    expect(() => validateTenantSlug("-acme")).toThrow(ApiError);
  });
});

describe("validateTenantStatus", () => {
  it("accepts active and suspended", () => {
    expect(validateTenantStatus("active")).toBe("active");
    expect(validateTenantStatus("suspended")).toBe("suspended");
  });

  it("rejects anything else", () => {
    expect(() => validateTenantStatus("disabled")).toThrow(ApiError);
    expect(() => validateTenantStatus(undefined)).toThrow(ApiError);
  });
});

describe("validateTenantName", () => {
  it("accepts 1-100 char names", () => {
    expect(validateTenantName("Acme")).toBe("Acme");
  });

  it("rejects empty or non-string names", () => {
    expect(() => validateTenantName("")).toThrow(ApiError);
    expect(() => validateTenantName(123)).toThrow(ApiError);
    expect(() => validateTenantName("a".repeat(101))).toThrow(ApiError);
  });
});
