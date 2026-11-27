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
    savingsExist: vi.fn(),
    verifyUser: vi.fn()
}));

vi.mock("@/models/savingCategory.model", () => ({ SavingCategoryModel: mocks }));
vi.mock("@/models/savings.model", () => ({ SavingsModel: { exists: mocks.savingsExist } }));
vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const date = new Date("2026-11-27T00:00:00Z");
const category = {
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(userId),
    name: "LIC",
    createdAt: date,
    updatedAt: date
};
const expected = {
    _id: id, userId, name: "LIC",
    createdAt: date.toISOString(), updatedAt: date.toISOString()
};
const fields = "success message errors { field message } response { _id userId name createdAt updatedAt }";
const operations = [
    { name: "savingCategories", query: `query { savingCategories { ${fields} } }`, method: mocks.find },
    {
        name: "addSavingCategory",
        query: `mutation($name: String!) { addSavingCategory(name: $name) { ${fields} } }`,
        method: mocks.create
    },
    {
        name: "updateSavingCategory",
        query: `mutation($id: ID!, $name: String!) { updateSavingCategory(_id: $id, name: $name) { ${fields} } }`,
        method: mocks.findOneAndUpdate
    },
    {
        name: "deleteSavingCategory",
        query: `mutation($id: ID!) { deleteSavingCategory(_id: $id) { ${fields} } }`,
        method: mocks.findOneAndDelete
    }
];
type Result = {
    success: boolean;
    message: string;
    response: typeof expected | typeof expected[] | null;
    errors: { field: string; message: string }[] | null;
};
const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });
beforeAll(async () => { await server.start(); });
afterAll(async () => { await server.stop(); });
beforeEach(() => {
    vi.resetAllMocks();
    mocks.verifyUser.mockReturnValue({ success: true, _id: userId, errors: null });
    mocks.find.mockResolvedValue([category]);
    for (const method of [mocks.findOne, mocks.create, mocks.findOneAndUpdate, mocks.findOneAndDelete]) {
        method.mockResolvedValue(category);
    }
    mocks.savingsExist.mockResolvedValue(null);
});

async function execute(name: string, variables = { id, name: " LIC " }) {
    const operation = operations.find(operation => operation.name === name);
    if (!operation) throw new Error("Unknown test operation");
    const result = await server.executeOperation<Record<string, Result>>(
        { query: operation.query, variables },
        { contextValue: { authHeader: "valid-token" } }
    );
    if (result.body.kind !== "single") throw new Error("Expected a single GraphQL response");
    expect(result.body.singleResult.errors).toBeUndefined();
    const data = result.body.singleResult.data?.[name];
    if (!data) throw new Error(`Missing ${name} response`);
    return data;
}

describe("saving category CRUD", () => {
    it.each(operations)("executes $name with user-scoped database access", async ({ name, method }) => {
        expect(await execute(name)).toMatchObject({
            success: true,
            response: name === "savingCategories" ? [expected] : expected,
            errors: null
        });
        if (name === "savingCategories") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ userId });
        } else if (name === "addSavingCategory") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ name: "LIC", userId });
        } else if (name === "updateSavingCategory") {
            expect(method).toHaveBeenCalledExactlyOnceWith(
                { _id: id, userId }, { $set: { name: "LIC" } }, { new: true, runValidators: true }
            );
        } else {
            expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
            expect(mocks.savingsExist).toHaveBeenCalledExactlyOnceWith({ savingCategoryId: id, userId });
            expect(method).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
        }
    });

    it.each(operations)("rejects failed authentication and missing user IDs for $name", async ({ name, method }) => {
        for (const user of [
            { success: false, errors: [{ field: "authHeader", message: "Invalid token" }] },
            { success: true, errors: null }
        ]) {
            mocks.verifyUser.mockReturnValue(user);
            expect(await execute(name)).toMatchObject({ success: false, message: "Unauthorized", response: null });
        }
        expect(method).not.toHaveBeenCalled();
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.savingsExist).not.toHaveBeenCalled();
    });

    it.each(["addSavingCategory", "updateSavingCategory"])("rejects blank names before writing in %s", async name => {
        expect(await execute(name, { id, name: "   " })).toMatchObject({
            success: false, response: null,
            errors: [{ field: "name", message: "Saving category name is required" }]
        });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each(["updateSavingCategory", "deleteSavingCategory"])("rejects invalid IDs in %s", async name => {
        expect(await execute(name, { id: "bad-id", name: "LIC" })).toMatchObject({
            success: false, response: null,
            errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
        });
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it.each(["updateSavingCategory", "deleteSavingCategory"])("returns not found for missing or other-user categories in %s", async name => {
        mocks.findOne.mockResolvedValue(null);
        mocks.findOneAndUpdate.mockResolvedValue(null);
        expect(await execute(name)).toMatchObject({
            success: false, message: "Saving category not found", response: null
        });
        const method = name === "updateSavingCategory" ? mocks.findOneAndUpdate : mocks.findOne;
        expect(method.mock.calls[0][0]).toEqual({ _id: id, userId });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("rejects deleting an in-use category without deleting any data", async () => {
        mocks.savingsExist.mockResolvedValue({ _id: new Types.ObjectId() });
        expect(await execute("deleteSavingCategory")).toMatchObject({
            success: false, message: "Saving category is in use", response: null,
            errors: [{ field: "_id", message: "Reassign or delete its savings before deleting this category" }]
        });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("reports failures while checking category usage without deleting", async () => {
        mocks.savingsExist.mockRejectedValue(new Error("Usage lookup failed"));
        expect(await execute("deleteSavingCategory")).toMatchObject({
            success: false, response: null,
            errors: [{ field: "unknown", message: "Usage lookup failed" }]
        });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it.each(operations)("returns structured database errors for $name", async ({ name, method }) => {
        method.mockRejectedValue(new Error("Database unavailable"));
        expect(await execute(name)).toMatchObject({
            success: false, response: null,
            errors: [{ field: "unknown", message: "Database unavailable" }]
        });
    });
});
