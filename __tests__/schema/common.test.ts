// @vitest-environment node

import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { idSchema, positiveAmountSchema } from "@/schema/common";

describe("MongoDB ID validation", () => {
    const id = "507f1f77bcf86cd799439011";

    it("accepts a hexadecimal string and normalizes an ObjectId to a string", () => {
        expect(idSchema.parse(id)).toBe(id);
        expect(idSchema.parse(new Types.ObjectId(id))).toBe(id);
    });

    it.each(["", "not-an-id", "507f1f77bcf86cd79943901", 123, null])("rejects invalid ID %j", (value) => {
        expect(idSchema.safeParse(value).success).toBe(false);
    });
});

describe("amount validation", () => {
    it.each([1, 1.5, 2500])("accepts amount %s", (amount) => {
        expect(positiveAmountSchema.parse(amount)).toBe(amount);
    });

    it.each([0, -1, 0.5, NaN, Infinity, "100", null])("rejects invalid amount %s", (amount) => {
        expect(positiveAmountSchema.safeParse(amount).success).toBe(false);
    });
});
