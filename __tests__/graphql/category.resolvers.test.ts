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
    expensesExist: vi.fn(), verifyUser: vi.fn()
}));
vi.mock("@/models/category.model", () => ({ CategoryModel: mocks }));
vi.mock("@/models/expense.model", () => ({ ExpenseModel: { exists: mocks.expensesExist } }));
vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const category = { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), name: "Movies" };
const expected = { _id: id, userId, name: "Movies" };
const fields = "success message errors { field message } response { _id userId name }";
const operations = [
    { name: "categories", query: `query { categories { ${fields} } }`, method: mocks.find },
    {
        name: "addCategory", method: mocks.create,
        query: `mutation($name: String!) { addCategory(name: $name) { ${fields} } }`
    },
    {
        name: "updateCategory", method: mocks.findOneAndUpdate,
        query: `mutation($id: ID!, $name: String!) { updateCategory(_id: $id, name: $name) { ${fields} } }`
    },
    {
        name: "deleteCategory", method: mocks.findOneAndDelete,
        query: `mutation($id: ID!) { deleteCategory(_id: $id) { ${fields} } }`
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
    mocks.find.mockResolvedValue([category]);
    mocks.findOne.mockImplementation(async filter => filter.name ? null : category);
    for (const method of [mocks.create, mocks.findOneAndUpdate, mocks.findOneAndDelete]) {
        method.mockResolvedValue(category);
    }
    mocks.expensesExist.mockResolvedValue(null);
});

async function execute(name: string, variables = { id, name: " Movies " }) {
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

describe("category CRUD", () => {
    it.each(operations)("executes $name with string IDs and user-scoped database access", async ({ name, method }) => {
        expect(await execute(name)).toMatchObject({
            success: true, response: name === "categories" ? [expected] : expected, errors: null
        });
        if (name === "categories") {
            expect(method).toHaveBeenCalledExactlyOnceWith({ userId });
        } else if (name === "addCategory") {
            expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ name: "Movies", userId });
            expect(method).toHaveBeenCalledExactlyOnceWith({ name: "Movies", userId });
        } else if (name === "updateCategory") {
            expect(method).toHaveBeenCalledExactlyOnceWith(
                { _id: id, userId }, { $set: { name: "Movies" } }, { new: true, runValidators: true }
            );
        } else {
            expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
            expect(mocks.expensesExist).toHaveBeenCalledExactlyOnceWith({ category: id, userId });
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
        expect(mocks.expensesExist).not.toHaveBeenCalled();
    });

    it.each(["addCategory", "updateCategory"])("rejects blank names before writing in %s", async name => {
        expect(await execute(name, { id, name: "   " })).toMatchObject({
            success: false, response: null, errors: [{ field: "name", message: "Name is required" }]
        });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects an existing category name for the current user", async () => {
        mocks.findOne.mockResolvedValue(category);
        expect(await execute("addCategory")).toMatchObject({
            success: false, message: "Category already exists", response: null
        });
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it.each(["updateCategory", "deleteCategory"])("rejects invalid IDs in %s", async name => {
        expect(await execute(name, { id: "bad-id", name: "Movies" })).toMatchObject({
            success: false, response: null, errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
        });
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it.each(["updateCategory", "deleteCategory"])("returns not found for missing or other-user categories in %s", async name => {
        mocks.findOne.mockResolvedValue(null);
        mocks.findOneAndUpdate.mockResolvedValue(null);
        expect(await execute(name)).toMatchObject({ success: false, message: "Category not found", response: null });
        const method = name === "updateCategory" ? mocks.findOneAndUpdate : mocks.findOne;
        expect(method.mock.calls[0][0]).toEqual({ _id: id, userId });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("rejects deleting a category used by expenses", async () => {
        mocks.expensesExist.mockResolvedValue({ _id: new Types.ObjectId() });
        expect(await execute("deleteCategory")).toMatchObject({
            success: false, message: "Category is in use", response: null,
            errors: [{ field: "_id", message: "Reassign or delete its expenses before deleting this category" }]
        });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("reports usage lookup errors without deleting", async () => {
        mocks.expensesExist.mockRejectedValue(new Error("Usage lookup failed"));
        expect(await execute("deleteCategory")).toMatchObject({
            success: false, response: null, errors: [{ field: "unknown", message: "Usage lookup failed" }]
        });
        expect(mocks.findOneAndDelete).not.toHaveBeenCalled();
    });

    it.each(operations)("returns structured database errors for $name", async ({ name, method }) => {
        method.mockRejectedValue(new Error("Database unavailable"));
        expect(await execute(name)).toMatchObject({
            success: false, response: null, errors: [{ field: "unknown", message: "Database unavailable" }]
        });
    });
});
