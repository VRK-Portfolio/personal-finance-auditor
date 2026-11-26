// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
    createIncomeInputSchema,
    deleteIncomeInputSchema,
    getIncomeSchema,
    updateIncomeInputSchema,
} from "@/schema/income.schema";

const id = "507f1f77bcf86cd799439011";
const input = { amount: 2500, source: "Salary", date: new Date("2026-01-01T00:00:00Z"), userId: id };

describe("income input validation", () => {
    it("accepts valid creation input and supplies a date when omitted", () => {
        expect(createIncomeInputSchema.parse(input)).toEqual(input);
        expect(createIncomeInputSchema.parse({ amount: 100, source: "Other", userId: id }).date)
            .toBeInstanceOf(Date);
    });

    it.each([
        { ...input, amount: 0 },
        { ...input, source: "" },
        { ...input, date: "2026-01-01" },
        { ...input, date: null },
        { ...input, userId: "invalid" },
        { ...input, userId: undefined },
        { source: input.source, date: input.date },
    ])("rejects invalid creation input: %j", (value) => {
        expect(createIncomeInputSchema.safeParse(value).success).toBe(false);
    });

    it("accepts partial updates and applies the existing date default", () => {
        expect(updateIncomeInputSchema.parse({ _id: id, amount: 500 })).toEqual({
            _id: id, amount: 500, date: expect.any(Date),
        });
    });

    it("requires a valid ID for updates and deletion", () => {
        expect(updateIncomeInputSchema.safeParse({ amount: 500 }).success).toBe(false);
        expect(updateIncomeInputSchema.safeParse({ _id: "invalid" }).success).toBe(false);
        expect(deleteIncomeInputSchema.parse({ _id: id })).toEqual({ _id: id });
        expect(deleteIncomeInputSchema.safeParse({ _id: "invalid" }).success).toBe(false);
    });

    it("requires valid income fields and an ID when reading records", () => {
        expect(getIncomeSchema.parse({ ...input, _id: id })).toEqual({ ...input, _id: id });
        expect(getIncomeSchema.safeParse(input).success).toBe(false);
        expect(getIncomeSchema.safeParse({ ...input, _id: id, amount: -1 }).success).toBe(false);
    });
});
