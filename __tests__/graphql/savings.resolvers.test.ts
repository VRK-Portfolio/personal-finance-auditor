// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import { resolvers } from "@/graphql/modules/resolvers";
import { typeDefs } from "@/graphql/modules/typeDefs";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    findCategory: vi.fn(),
    verifyUser: vi.fn()
}));

vi.mock("@/models/savings.model", () => ({ SavingsModel: mocks }));
vi.mock("@/models/savingCategory.model", () => ({
    SavingCategoryModel: { findOne: mocks.findCategory }
}));
vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const savingCategoryId = "507f1f77bcf86cd799439013";
const date = new Date("2026-01-01T12:30:00Z");
const document = {
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(userId),
    amount: 100,
    savingCategoryId: new Types.ObjectId(savingCategoryId),
    savingDate: date,
    createdAt: date,
    updatedAt: date
};
const expected = {
    _id: id,
    userId,
    amount: 100,
    savingCategoryId,
    savingDate: date.toISOString(),
    createdAt: date.toISOString(),
    updatedAt: date.toISOString()
};
const fields = "success message errors { field message } response { _id userId amount savingCategoryId savingDate createdAt updatedAt }";
const operations = [
    { name: "savings", query: `query { savings { ${fields} } }`, method: mocks.find },
    { name: "savingsById", query: `query($id: ID!) { savingsById(_id: $id) { ${fields} } }`, method: mocks.findOne },
    {
        name: "addSavings",
        query: `mutation($amount: Float!, $savingCategoryId: ID!, $savingDate: String) {
            addSavings(amount: $amount, savingCategoryId: $savingCategoryId, savingDate: $savingDate) { ${fields} }
        }`,
        method: mocks.create
    },
    {
        name: "updateSavings",
        query: `mutation($id: ID!, $amount: Float, $savingCategoryId: ID, $savingDate: String) {
            updateSavings(_id: $id, amount: $amount, savingCategoryId: $savingCategoryId, savingDate: $savingDate) { ${fields} }
        }`,
        method: mocks.findOneAndUpdate
    },
    { name: "deleteSavings", query: `mutation($id: ID!) { deleteSavings(_id: $id) { ${fields} } }`, method: mocks.findOneAndDelete }
];
type Result = {
    success: boolean;
    message: string;
    response: typeof expected | typeof expected[] | null;
    errors: { field: string; message: string }[] | null;
};
const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
const variables = { id, amount: 100, savingCategoryId, savingDate: date.toISOString() };

beforeAll(async () => { await server.start(); });
afterAll(async () => { await server.stop(); });
beforeEach(() => {
    vi.resetAllMocks();
    mocks.verifyUser.mockReturnValue({ success: true, _id: userId, errors: null });
    mocks.findCategory.mockResolvedValue({ _id: new Types.ObjectId(savingCategoryId), userId: new Types.ObjectId(userId) });
    mocks.find.mockResolvedValue([document]);
    for (const method of [mocks.findOne, mocks.create, mocks.findOneAndUpdate, mocks.findOneAndDelete]) {
        method.mockResolvedValue(document);
    }
});

async function execute(name: string, input: Record<string, unknown> = variables) {
    const operation = operations.find(operation => operation.name === name);
    if (!operation) throw new Error("Unknown test operation");
    const result = await server.executeOperation<Record<string, Result>>(
        { query: operation.query, variables: input },
        { contextValue: { authHeader: "valid-token" } }
    );
    if (result.body.kind !== "single") throw new Error("Expected a single GraphQL response");
    expect(result.body.singleResult.errors).toBeUndefined();
    const data = result.body.singleResult.data?.[name];
    if (!data) throw new Error(`Missing ${name} response`);
    return data;
}

describe("savings CRUD", () => {
    it.each(operations)("executes $name through the combined schema with ISO dates", async ({ name, method }) => {
        expect(await execute(name)).toMatchObject({
            success: true,
            response: name === "savings" ? [expected] : expected,
            errors: null
        });
        if (name === "savings") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ userId });
        } else if (name === "addSavings") {
            expect(method).toHaveBeenCalledExactlyOnceWith({
                amount: 100, savingCategoryId, savingDate: date, userId
            });
            expect(mocks.findCategory).toHaveBeenCalledExactlyOnceWith({ _id: savingCategoryId, userId });
        } else if (name === "updateSavings") {
            expect(method).toHaveBeenCalledExactlyOnceWith(
                { _id: id, userId },
                { $set: { amount: 100, savingCategoryId, savingDate: date } },
                { new: true, runValidators: true }
            );
        } else {
            expect(method).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
        }
    });

    it.each(operations)("rejects unauthorized and missing-user requests for $name", async ({ name, method }) => {
        for (const auth of [
            { success: false, errors: [{ field: "authHeader", message: "Invalid or expired token" }] },
            { success: true, errors: null }
        ]) {
            mocks.verifyUser.mockReturnValue(auth);
            expect(await execute(name)).toMatchObject({ success: false, message: "Unauthorized", response: null });
        }
        expect(method).not.toHaveBeenCalled();
        expect(mocks.findCategory).not.toHaveBeenCalled();
    });

    it.each(operations.filter(operation => ["savingsById", "updateSavings", "deleteSavings"].includes(operation.name)))(
        "rejects invalid IDs and missing/other-user records for $name",
        async ({ name, method }) => {
            expect(await execute(name, { ...variables, id: "bad-id" })).toMatchObject({
                success: false, errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
            });
            expect(method).not.toHaveBeenCalled();
            method.mockResolvedValue(null);
            expect(await execute(name)).toMatchObject({
                success: false, message: "Savings not found", response: null
            });
            expect(method.mock.calls[0][0]).toEqual({ _id: id, userId });
        }
    );

    it.each(operations)("returns structured database errors for $name", async ({ name, method }) => {
        method.mockRejectedValue(new Error("Database unavailable"));
        expect(await execute(name)).toMatchObject({
            success: false,
            response: null,
            errors: [{ field: "unknown", message: "Database unavailable" }]
        });
    });

    it("returns an empty list when the user has no savings", async () => {
        mocks.find.mockResolvedValue([]);
        expect(await execute("savings")).toMatchObject({ success: true, response: [] });
    });

    it.each(["addSavings", "updateSavings"])("validates input before database writes in %s", async name => {
        for (const invalid of [
            { amount: 0 }, { amount: 0.5 }, { amount: -1 }, { savingCategoryId: "bad-id" },
            { savingDate: "not-a-date" }, { savingDate: "2026-02-30" }
        ]) {
            const result = await execute(name, { ...variables, ...invalid });
            expect(result.success).toBe(false);
            expect(result.response).toBeNull();
            expect(result.errors?.[0].field).toBe(Object.keys(invalid)[0]);
        }
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("normalizes date-only inputs", async () => {
        await execute("addSavings", { ...variables, savingDate: "2026-01-01" });
        expect(mocks.create).toHaveBeenCalledWith({
            amount: 100, savingCategoryId, savingDate: new Date("2026-01-01T00:00:00Z"), userId
        });
    });

    it.each([null, undefined])("defaults a %s create date to the current time on each request", async savingDate => {
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
            mocks.create.mockImplementation(async input => ({ ...document, savingDate: input.savingDate }));
            for (const now of ["2026-11-27T04:30:00Z", "2026-11-28T04:30:00Z"]) {
                vi.setSystemTime(new Date(now));
                const input: Record<string, unknown> = { amount: 20000, savingCategoryId };
                if (savingDate === null) input.savingDate = null;
                expect(await execute("addSavings", input)).toMatchObject({
                    success: true,
                    response: { savingDate: new Date(now).toISOString() },
                    errors: null
                });
                expect(mocks.create).toHaveBeenLastCalledWith({
                    amount: 20000, savingCategoryId, savingDate: new Date(now), userId
                });
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it("preserves omitted update fields", async () => {
        await execute("updateSavings", { id, amount: 200 });
        expect(mocks.findOneAndUpdate).toHaveBeenCalledExactlyOnceWith(
            { _id: id, userId }, { $set: { amount: 200 } }, { new: true, runValidators: true }
        );
        expect(mocks.findCategory).not.toHaveBeenCalled();
    });

    it("rejects empty updates and explicit null values", async () => {
        for (const input of [{ id }, { id, amount: null }, { id, savingCategoryId: null }, { id, savingDate: null }]) {
            expect(await execute("updateSavings", input)).toMatchObject({ success: false, response: null });
        }
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each(["addSavings", "updateSavings"])("rejects missing or other-user categories before writing in %s", async name => {
        mocks.findCategory.mockResolvedValue(null);
        expect(await execute(name)).toMatchObject({
            success: false,
            message: "Saving category not found",
            response: null,
            errors: [{ field: "savingCategoryId", message: "Saving category not found" }]
        });
        expect(mocks.findCategory).toHaveBeenCalledExactlyOnceWith({ _id: savingCategoryId, userId });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each(["addSavings", "updateSavings"])("reports category lookup failures without writing in %s", async name => {
        mocks.findCategory.mockRejectedValue(new Error("Category lookup failed"));
        expect(await execute(name)).toMatchObject({
            success: false, response: null,
            errors: [{ field: "unknown", message: "Category lookup failed" }]
        });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
