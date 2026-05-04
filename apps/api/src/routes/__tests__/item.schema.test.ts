import { describe, expect, it } from "vitest";
import { itemSchema } from "../schemas/item.schema";

describe("itemSchema", () => {
  it("accepts category_id values without route schema UUID validation", () => {
    expect(
      itemSchema.safeParse({
        category_id: "category-1",
        sku: "COMP-001",
        name: "Industrial Sensor",
        unit_price: 199.9,
      }).success,
    ).toBe(true);
  });

  it("accepts unit_price values with up to two decimal places", () => {
    expect(
      itemSchema.safeParse({
        sku: "COMP-001",
        name: "Industrial Sensor",
        unit_price: 199.9,
      }).success,
    ).toBe(true);

    expect(
      itemSchema.safeParse({
        sku: "COMP-002",
        name: "Small Part",
        unit_price: 0.29,
      }).success,
    ).toBe(true);

    expect(
      itemSchema.safeParse({
        sku: "COMP-003",
        name: "Maximum Price Item",
        unit_price: 99999999.99,
      }).success,
    ).toBe(true);
  });

  it("rejects unit_price values with more than two decimal places", () => {
    const parsed = itemSchema.safeParse({
      sku: "COMP-001",
      name: "Industrial Sensor",
      unit_price: 199.999,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected unit_price validation to fail");
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "unit_price must have at most 2 decimal places",
          path: ["unit_price"],
        }),
      ]),
    );
  });

  it("rejects unit_price values above DECIMAL(10,2) bounds", () => {
    const parsed = itemSchema.safeParse({
      sku: "COMP-001",
      name: "Industrial Sensor",
      unit_price: 100000000,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected unit_price max validation to fail");
    }

    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "unit_price must be <= 99999999.99 (DECIMAL(10,2))",
          path: ["unit_price"],
        }),
      ]),
    );
  });
});
