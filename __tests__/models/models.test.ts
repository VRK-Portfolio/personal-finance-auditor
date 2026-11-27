// @vitest-environment node

import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { IncomeModel } from "@/models/income.model";
import { UserModel } from "@/models/users.model";
import { SavingsModel } from "@/models/savings.model";
import { SavingCategoryModel } from "@/models/savingCategory.model";
import { ExpenseModel } from "@/models/expense.model";
import { CategoryModel } from "@/models/category.model";
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

describe("ExpenseModel validation", () => {
    const input = {
        amount: 25, category: "507f1f77bcf86cd799439012",
        userId: "507f1f77bcf86cd799439011", merchant: "Cinema"
    };

    it("stores category and owner ObjectIds, accepts merchant text, and defaults the date", async () => {
        const expense = new ExpenseModel(input);
        await expect(expense.validate()).resolves.toBeUndefined();
        expect(expense.toObject()).toMatchObject({
            ...input, category: new Types.ObjectId(input.category), userId: new Types.ObjectId(input.userId)
        });
        expect(expense.date).toBeInstanceOf(Date);
    });

    it.each([{ amount: 0 }, { category: null }, { category: "bad-id" }, { userId: null }])(
        "rejects invalid expense fields: %j", async invalid => {
            await expect(new ExpenseModel({ ...input, ...invalid }).validate()).rejects.toMatchObject({
                errors: { [Object.keys(invalid)[0]]: expect.anything() }
            });
        }
    );
});

describe("CategoryModel validation", () => {
    it("trims names and stores the owner as an ObjectId", async () => {
        const userId = "507f1f77bcf86cd799439011";
        const category = new CategoryModel({ name: " Movies ", userId });
        await expect(category.validate()).resolves.toBeUndefined();
        expect(category.toObject()).toMatchObject({ name: "Movies", userId: new Types.ObjectId(userId) });
    });

    it("rejects blank names and missing owners", async () => {
        await expect(new CategoryModel({ name: "   " }).validate()).rejects.toMatchObject({
            errors: { name: expect.anything(), userId: expect.anything() }
        });
    });
});

describe("SavingsModel validation", () => {
    const input = {
        amount: 100,
        savingCategoryId: "507f1f77bcf86cd799439012",
        savingDate: new Date("2026-01-01"),
        userId: "507f1f77bcf86cd799439011"
    };

    it("stores both the owner and saving category as ObjectIds", async () => {
        const savings = new SavingsModel(input);
        await expect(savings.validate()).resolves.toBeUndefined();
        expect(savings.toObject()).toMatchObject({
            ...input,
            userId: new Types.ObjectId(input.userId),
            savingCategoryId: new Types.ObjectId(input.savingCategoryId)
        });
    });

    it.each([
        { amount: 0 }, { savingCategoryId: null }, { savingCategoryId: "bad-id" }, { savingDate: null }, { userId: null }
    ])("rejects invalid savings fields: %j", async invalid => {
        await expect(new SavingsModel({ ...input, ...invalid }).validate()).rejects.toMatchObject({
            errors: { [Object.keys(invalid)[0]]: expect.anything() }
        });
    });
});

describe("SavingCategoryModel validation", () => {
    it("trims the name and stores the authenticated owner as an ObjectId", async () => {
        const userId = "507f1f77bcf86cd799439011";
        const category = new SavingCategoryModel({ name: " LIC ", userId });
        await expect(category.validate()).resolves.toBeUndefined();
        expect(category.toObject()).toMatchObject({ name: "LIC", userId: new Types.ObjectId(userId) });
    });

    it("requires a nonblank name and an owner", async () => {
        await expect(new SavingCategoryModel({ name: "   " }).validate()).rejects.toMatchObject({
            errors: { name: expect.anything(), userId: expect.anything() }
        });
    });
});

it("reuses registered Mongoose models after a module reload", async () => {
    vi.resetModules();
    const [incomeModule, userModule, savingsModule, savingCategoryModule, expenseModule, categoryModule] = await Promise.all([
        import("@/models/income.model"),
        import("@/models/users.model"),
        import("@/models/savings.model"),
        import("@/models/savingCategory.model"),
        import("@/models/expense.model"),
        import("@/models/category.model"),
    ]);

    expect(incomeModule.IncomeModel).toBe(IncomeModel);
    expect(userModule.UserModel).toBe(UserModel);
    expect(savingsModule.SavingsModel).toBe(SavingsModel);
    expect(savingCategoryModule.SavingCategoryModel).toBe(SavingCategoryModel);
    expect(expenseModule.ExpenseModel).toBe(ExpenseModel);
    expect(categoryModule.CategoryModel).toBe(CategoryModel);
});
