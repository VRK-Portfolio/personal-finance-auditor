// @vitest-environment node

import { describe, expect, it } from "vitest";
import { IncomeModel } from "@/models/income.model";
import { UserModel } from "@/models/users.model";

describe("UserModel validation", () => {
    it("accepts required user fields and applies the default role", async () => {
        const user = new UserModel({ email: "test@example.com", password: "hashed-password" });

        await expect(user.validate()).resolves.toBeUndefined();
        expect(user.toObject()).toMatchObject({
            email: "test@example.com",
            password: "hashed-password",
            role: "user",
        });
    });

    it("reports missing email and password", async () => {
        await expect(new UserModel({}).validate()).rejects.toMatchObject({
            errors: {
                email: expect.objectContaining({ path: "email" }),
                password: expect.objectContaining({ path: "password" }),
            },
        });
    });
});

describe("IncomeModel validation", () => {
    it("accepts required fields and defaults the date", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary" });

        await expect(income.validate()).resolves.toBeUndefined();
        expect(income.date).toBeInstanceOf(Date);
    });

    it("reports missing amount and source", async () => {
        await expect(new IncomeModel({}).validate()).rejects.toMatchObject({
            errors: {
                amount: expect.objectContaining({ path: "amount" }),
                source: expect.objectContaining({ path: "source" }),
            },
        });
    });

    it("reports an invalid date instead of accepting an uncastable value", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", date: "not-a-date" });

        await expect(income.validate()).rejects.toMatchObject({
            errors: { date: expect.objectContaining({ path: "date" }) },
        });
    });
});
