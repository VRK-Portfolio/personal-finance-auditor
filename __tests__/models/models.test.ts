// @vitest-environment node

import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { IncomeModel } from "@/models/income.model";
import { UserModel } from "@/models/users.model";
import { getIncomeSchema } from "@/schema/income.schema";

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
    const userId = "507f1f77bcf86cd799439011";

    it("accepts required fields and defaults the date", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", userId });

        await expect(income.validate()).resolves.toBeUndefined();
        expect(income.date).toBeInstanceOf(Date);
    });

    it("stores the user ID as an ObjectId and normalizes API IDs to strings", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", userId });

        await expect(income.validate()).resolves.toBeUndefined();
        const storedUserId: Types.ObjectId = income.userId;
        expect(storedUserId).toBeInstanceOf(Types.ObjectId);
        expect(storedUserId.toHexString()).toBe(userId);
        expect(getIncomeSchema.parse(income.toObject())).toMatchObject({
            _id: income._id.toHexString(),
            userId,
        });
    });

    it("reports missing amount, source, and user ID", async () => {
        await expect(new IncomeModel({}).validate()).rejects.toMatchObject({
            errors: {
                amount: expect.objectContaining({ path: "amount" }),
                source: expect.objectContaining({ path: "source" }),
                userId: expect.objectContaining({ path: "userId" }),
            },
        });
    });

    it("reports an invalid date instead of accepting an uncastable value", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", userId, date: "not-a-date" });

        await expect(income.validate()).rejects.toMatchObject({
            errors: { date: expect.objectContaining({ path: "date" }) },
        });
    });

    it("rejects a null date instead of applying the date default", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", userId, date: null });

        await expect(income.validate()).rejects.toMatchObject({
            errors: { date: expect.objectContaining({ path: "date" }) },
        });
    });

    it("reports an invalid user ID instead of storing an uncastable value", async () => {
        const income = new IncomeModel({ amount: 100, source: "Salary", userId: "invalid" });

        await expect(income.validate()).rejects.toMatchObject({
            errors: { userId: expect.objectContaining({ path: "userId" }) },
        });
    });
});

it("reuses registered Mongoose models after a module reload", async () => {
    vi.resetModules();
    const [incomeModule, userModule] = await Promise.all([
        import("@/models/income.model"),
        import("@/models/users.model"),
    ]);

    expect(incomeModule.IncomeModel).toBe(IncomeModel);
    expect(userModule.UserModel).toBe(UserModel);
});
