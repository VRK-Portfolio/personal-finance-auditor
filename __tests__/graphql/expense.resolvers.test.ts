// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import { resolvers } from "@/graphql/modules/resolvers";
import { typeDefs } from "@/graphql/modules/typeDefs";

const mocks = vi.hoisted(() => ({
    find: vi.fn(), findOne: vi.fn(), create: vi.fn(),
    findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn(),
    findCategory: vi.fn(), verifyUser: vi.fn()
}));
vi.mock("@/models/expense.model", () => ({ ExpenseModel: mocks }));
vi.mock("@/models/category.model", () => ({ CategoryModel: { findOne: mocks.findCategory } }));
vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const categoryId = "507f1f77bcf86cd799439013";
const date = new Date("2026-01-01T12:30:00Z");
const document = {
    _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId),
    category: new Types.ObjectId(categoryId), amount: 25,
    merchant: "Cinema", description: "Movie ticket", date
};
const expected = {
    _id: id, userId, category: categoryId, amount: 25,
    merchant: "Cinema", description: "Movie ticket", date: date.toISOString()
};
const input = { amount: 25, category: categoryId, merchant: "Cinema", description: "Movie ticket", date: date.toISOString() };
const fields = "success message errors { field message } response { _id userId amount category date merchant description }";
const operations = [
    {
        name: "expenses", method: mocks.find,
        query: `query($startDate: String, $endDate: String) { expenses(startDate: $startDate, endDate: $endDate) { ${fields} } }`
    },
    {
        name: "expenseById", method: mocks.findOne,
        query: `query($id: ID!) { expenseById(_id: $id) { ${fields} } }`
    },
    {
        name: "addExpense", method: mocks.create,
        query: `mutation($input: ExpenseInput!) { addExpense(input: $input) { ${fields} } }`
    },
    {
        name: "updateExpense", method: mocks.findOneAndUpdate,
        query: `mutation($id: ID!, $input: UpdateExpenseInput!) { updateExpense(_id: $id, input: $input) { ${fields} } }`
    },
    {
        name: "deleteExpense", method: mocks.findOneAndDelete,
        query: `mutation($id: ID!) { deleteExpense(_id: $id) { ${fields} } }`
    }
];
type Result = {
    success: boolean; message: string;
    response: typeof expected | typeof expected[] | null;
    errors: { field: string; message: string }[] | null;
};
const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
beforeAll(async () => { await server.start(); });
afterAll(async () => { await server.stop(); });
beforeEach(() => {
    vi.resetAllMocks();
    mocks.verifyUser.mockReturnValue({ success: true, _id: userId, errors: null });
    mocks.findCategory.mockResolvedValue({ _id: new Types.ObjectId(categoryId), userId: new Types.ObjectId(userId) });
    mocks.find.mockResolvedValue([document]);
    for (const method of [mocks.findOne, mocks.create, mocks.findOneAndUpdate, mocks.findOneAndDelete]) {
        method.mockResolvedValue(document);
    }
});

async function execute(name: string, variables: Record<string, unknown> = { id, input }) {
    const operation = operations.find(operation => operation.name === name);
    if (!operation) throw new Error("Unknown test operation");
    const result = await server.executeOperation<Record<string, Result>>(
        { query: operation.query, variables }, { contextValue: { authHeader: "valid-token" } }
    );
    if (result.body.kind !== "single") throw new Error("Expected a single GraphQL response");
    expect(result.body.singleResult.errors).toBeUndefined();
    const data = result.body.singleResult.data?.[name];
    if (!data) throw new Error(`Missing ${name} response`);
    return data;
}

describe("expense CRUD", () => {
    it.each(operations)("executes $name through the combined schema with ISO dates and user-scoped access", async ({ name, method }) => {
        expect(await execute(name)).toMatchObject({
            success: true, response: name === "expenses" ? [expected] : expected, errors: null
        });
        if (name === "expenses") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ userId });
        } else if (name === "addExpense") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ ...input, date, userId });
            expect(mocks.findCategory).toHaveBeenCalledExactlyOnceWith({ _id: categoryId, userId });
        } else if (name === "updateExpense") {
            expect(method).toHaveBeenCalledExactlyOnceWith(
                { _id: id, userId }, { $set: { ...input, date } }, { new: true, runValidators: true }
            );
            expect(mocks.findCategory).toHaveBeenCalledExactlyOnceWith({ _id: categoryId, userId });
        } else {
            expect(method).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
        }
    });

    it.each(["addExpense", "expenses"])("serializes valid legacy string category IDs in %s", async name => {
        const legacyDocument = { ...document, category: categoryId };
        mocks.create.mockResolvedValue(legacyDocument);
        mocks.find.mockResolvedValue([legacyDocument]);
        expect(await execute(name)).toMatchObject({
            success: true,
            response: name === "expenses" ? [expected] : expected,
            errors: null
        });
    });

    it("reports invalid stored category IDs instead of treating them as valid references", async () => {
        mocks.findOne.mockResolvedValue({ ...document, category: "not-an-id" });
        expect(await execute("expenseById")).toMatchObject({
            success: false, response: null,
            errors: [{ field: "unknown", message: expect.stringContaining("Invalid MongoDB ObjectId") }]
        });
    });

    it.each(operations)("rejects unauthorized and missing-user requests for $name", async ({ name, method }) => {
        for (const user of [
            { success: false, errors: [{ field: "authHeader", message: "Invalid token" }] },
            { success: true, errors: null }
        ]) {
            mocks.verifyUser.mockReturnValue(user);
            expect(await execute(name)).toMatchObject({ success: false, message: "Unauthorized", response: null });
        }
        expect(method).not.toHaveBeenCalled();
        expect(mocks.findCategory).not.toHaveBeenCalled();
    });

    it.each(["expenseById", "updateExpense", "deleteExpense"])("rejects invalid IDs and missing/other-user records in %s", async name => {
        expect(await execute(name, { id: "bad-id", input })).toMatchObject({
            success: false, errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
        });
        const method = operations.find(operation => operation.name === name)?.method;
        if (!method) throw new Error("Missing method");
        expect(method).not.toHaveBeenCalled();
        method.mockResolvedValue(null);
        expect(await execute(name)).toMatchObject({ success: false, message: "Expense not found", response: null });
        expect(method.mock.calls[0][0]).toEqual({ _id: id, userId });
    });

    it.each(["addExpense", "updateExpense"])("validates fields before writing in %s", async name => {
        for (const invalid of [{ amount: 0 }, { amount: 0.5 }, { category: "bad-id" }, { date: "2026-02-30" }, { date: "" }]) {
            expect(await execute(name, { id, input: { ...input, ...invalid } })).toMatchObject({
                success: false, response: null, errors: [{ field: Object.keys(invalid)[0], message: expect.any(String) }]
            });
        }
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
        expect(mocks.findCategory).not.toHaveBeenCalled();
    });

    it.each(["addExpense", "updateExpense"])("rejects missing or other-user categories before writing in %s", async name => {
        mocks.findCategory.mockResolvedValue(null);
        expect(await execute(name)).toMatchObject({
            success: false, response: null, errors: [{ field: "category", message: "Category not found" }]
        });
        expect(mocks.findCategory).toHaveBeenCalledExactlyOnceWith({ _id: categoryId, userId });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each(operations)("returns structured database errors for $name", async ({ name, method }) => {
        method.mockRejectedValue(new Error("Database unavailable"));
        expect(await execute(name)).toMatchObject({
            success: false, response: null, errors: [{ field: "unknown", message: "Database unavailable" }]
        });
    });

    it.each([null, undefined])("defaults a %s create date to the current time", async value => {
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
            vi.setSystemTime(new Date("2026-11-27T04:30:00Z"));
            const createInput: Record<string, unknown> = { amount: 25, category: categoryId, merchant: "Cinema" };
            if (value === null) createInput.date = null;
            expect(await execute("addExpense", { input: createInput })).toMatchObject({ success: true });
            expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
                amount: 25, category: categoryId, merchant: "Cinema", userId,
                date: new Date("2026-11-27T04:30:00Z")
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("normalizes date-only inputs before writing", async () => {
        await execute("addExpense", { input: { ...input, date: "2026-01-01" } });
        expect(mocks.create).toHaveBeenCalledWith({ ...input, date: new Date("2026-01-01T00:00:00Z"), userId });
    });

    it("preserves omitted update fields and permits clearing optional text", async () => {
        await execute("updateExpense", { id, input: { amount: 50, merchant: null } });
        expect(mocks.findOneAndUpdate).toHaveBeenCalledExactlyOnceWith(
            { _id: id, userId }, { $set: { amount: 50, merchant: null } }, { new: true, runValidators: true }
        );
        expect(mocks.findCategory).not.toHaveBeenCalled();
    });

    it("rejects empty updates and null required fields", async () => {
        for (const update of [{}, { amount: null }, { category: null }, { date: null }]) {
            expect(await execute("updateExpense", { id, input: update })).toMatchObject({ success: false, response: null });
        }
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("filters the authenticated user's dates through the end day, excluding the next midnight", async () => {
        await execute("expenses", { startDate: "2026-01-01", endDate: "2026-01-02" });
        expect(mocks.find).toHaveBeenCalledExactlyOnceWith({
            userId,
            date: { $gte: new Date("2026-01-01T00:00:00Z"), $lt: new Date("2026-01-03T00:00:00Z") }
        });
    });

    it("rejects invalid and reversed date ranges before database access", async () => {
        for (const range of [
            { startDate: "not-a-date", endDate: "2026-01-02" },
            { startDate: "2026-01-03", endDate: "2026-01-02" }
        ]) {
            expect(await execute("expenses", range)).toMatchObject({ success: false, response: null });
        }
        expect(mocks.find).not.toHaveBeenCalled();
    });
});
