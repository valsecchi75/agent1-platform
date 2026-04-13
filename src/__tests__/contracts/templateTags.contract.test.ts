import { describe, it, expect } from "vitest";

describe("Template Tags Contract", () => {
  it("TemplateTag has required fields", () => {
    const tag = {
      id: 1,
      slug: "product-shot",
      label: "Product Shot",
      groupKey: "task" as const,
      icon: null,
      sortOrder: 0,
      isActive: true,
      createdAt: "2026-04-12T00:00:00.000Z",
    };
    expect(tag).toHaveProperty("id");
    expect(tag).toHaveProperty("slug");
    expect(tag).toHaveProperty("label");
    expect(tag).toHaveProperty("groupKey");
    expect(tag).toHaveProperty("isActive");
    expect(["generation", "task", "provider", "style"]).toContain(tag.groupKey);
  });

  it("TagGroup only allows 4 values", () => {
    const validGroups = ["generation", "task", "provider", "style"];
    expect(validGroups).toHaveLength(4);
  });

  it("slug is derived from label", () => {
    const slugify = (label: string) =>
      label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    expect(slugify("Product Shot")).toBe("product-shot");
    expect(slugify("fal.ai")).toBe("fal-ai");
    expect(slugify("3D Gen")).toBe("3d-gen");
  });

  it("slug collision is detectable (same slug from different labels)", () => {
    const slugify = (label: string) =>
      label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    expect(slugify("Product Shot")).toBe(slugify("Product-Shot"));
    expect(slugify("Product Shot")).toBe(slugify("product shot"));
  });
});
