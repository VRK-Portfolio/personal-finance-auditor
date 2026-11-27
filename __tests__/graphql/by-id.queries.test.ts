// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import { resolvers } from "@/graphql/modules/resolvers";
import { typeDefs } from "@/graphql/modules/typeDefs";

const mocks = vi.hoisted(() => ({
    findIncome: vi.fn(),
    findExpense: vi.fn(),
    findCategory: vi.fn(),
    verifyUser: vi.fn(),
}));

vi.mock("@/models/income.model", () => ({
    IncomeModel: { findOne: mocks.findIncome },
}));
vi.mock("@/models/expense.model", () => ({
    ExpenseModel: { findOne: mocks.findExpense },
}));
vi.mock("@/models/category.model", () => ({
    CategoryModel: { findOne: mocks.findCategory },
}));
vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const otherUserId = "507f1f77bcf86cd799439013";
const date = new Date("2026-01-01T12:30:00Z");
const context: GraphQLContext = { authHeader: "valid-token" };
const baseDocument = { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) };
const income = { ...baseDocument, amount: 100, source: "Salary", date };
const expense = {
    ...baseDocument,
    amount: 25,
    category: new Types.ObjectId("507f1f77bcf86cd799439014"),
    merchant: "Cinema",
    description: "Movie ticket",
    date,
};
const category = { ...baseDocument, name: "Movies" };
const cases = [
    {
        operation: "incomeById",
        label: "Income",
        find: mocks.findIncome,
        document: income,
        fields: "_id amount source date",
        expected: { _id: id, amount: 100, source: "Salary", date: date.toISOString() },
    },
    {
        operation: "expenseById",
        label: "Expense",
        find: mocks.findExpense,
        document: expense,
        fields: "_id userId amount category date merchant description",
        expected: {
            _id: id, userId, amount: 25, category: expense.category.toHexString(),
            date: date.toISOString(), merchant: "Cinema", description: "Movie ticket",
        },
    },
    {
        operation: "categoryById",
        label: "Category",
        find: mocks.findCategory,
        document: category,
        fields: "_id userId name",
        expected: { _id: id, userId, name: "Movies" },
    },
] as const;

type LookupResult = {
    success: boolean;
    message: string;
    response: Record<string, unknown> | null;
    errors: { field: string; message: string }[] | null;
};

const server = new ApolloServer<GraphQLContext>({ typeDefs, resolvers });

beforeAll(async () => {
    await server.start();
});

afterAll(async () => {
    await server.stop();
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.verifyUser.mockReturnValue({
        success: true, message: "Authorized", errors: null, _id: userId,
    });
    for (const testCase of cases) {
        testCase.find.mockResolvedValue({
            ...testCase.document,
            toObject: () => testCase.document,
        });
    }
});

describe.each(cases)("$operation", ({ operation, label, find, fields, expected }) => {
    const query = `
        query Lookup($id: ID!) {
            ${operation}(_id: $id) {
                success message errors { field message }
                response { ${fields} }
            }
        }
    `;

    async function execute(lookupId = id, requestContext = context) {
        const result = await server.executeOperation<Record<string, LookupResult>>(
            { query, variables: { id: lookupId } },
            { contextValue: requestContext },
        );
        if (result.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }
        expect(result.body.singleResult.errors).toBeUndefined();
        const data = result.body.singleResult.data?.[operation];
        if (!data) {
            throw new Error(`Missing ${operation} response`);
        }
        return data;
    }

    it("returns a single owned record through the combined GraphQL schema", async () => {
        expect(await execute()).toEqual({
            success: true,
            message: `${label} fetched successfully`,
            response: expected,
            errors: null,
        });
        expect(find).toHaveBeenCalledExactlyOnceWith({ _id: id, userId });
        expect(mocks.verifyUser).toHaveBeenCalledWith("valid-token");
    });

    it.each([
        [null, "Authorization header is missing"],
        ["expired-token", "Invalid or expired token"],
    ])("rejects unauthorized requests before querying the database: %s", async (authHeader, message) => {
        mocks.verifyUser.mockReturnValue({
            success: false,
            message: "Unauthorized",
            errors: [{ field: "authHeader", message }],
        });

        expect(await execute(id, { authHeader })).toEqual({
            success: false,
            message: "Unauthorized",
            response: null,
            errors: [{ field: "authHeader", message }],
        });
        expect(find).not.toHaveBeenCalled();
    });

    it("rejects authentication results without a user ID", async () => {
        mocks.verifyUser.mockReturnValue({ success: true, errors: null });

        expect(await execute()).toMatchObject({
            success: false,
            message: "Unauthorized",
            response: null,
            errors: [{ field: "authHeader", message: "User ID is missing" }],
        });
        expect(find).not.toHaveBeenCalled();
    });

    it.each(["invalid-id", "", "507f1f77bcf86cd79943901"])(
        "rejects malformed record IDs without querying the database: %j",
        async (lookupId) => {
            expect(await execute(lookupId)).toEqual({
                success: false,
                message: `Invalid ${label.toLowerCase()} ID`,
                response: null,
                errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }],
            });
            expect(find).not.toHaveBeenCalled();
        },
    );

    it("returns a structured not-found response", async () => {
        find.mockResolvedValue(null);

        expect(await execute()).toEqual({
            success: false,
            message: `${label} not found`,
            response: null,
            errors: [{ field: "_id", message: `${label} not found` }],
        });
    });

    it("does not return a different user's record", async () => {
        mocks.verifyUser.mockReturnValue({ success: true, errors: null, _id: otherUserId });
        find.mockImplementation(async (filter: { _id: string; userId: string }) =>
            filter._id === id && filter.userId === userId ? { toObject: () => expected } : null,
        );

        expect(await execute()).toMatchObject({
            success: false,
            message: `${label} not found`,
            response: null,
        });
        expect(find).toHaveBeenCalledExactlyOnceWith({ _id: id, userId: otherUserId });
    });

    it.each([
        [new Error("Database unavailable"), "Database unavailable"],
        ["unexpected rejection", "Something went wrong"],
    ])("returns structured database errors", async (error, message) => {
        find.mockRejectedValue(error);

        expect(await execute()).toEqual({
            success: false,
            message: `Failed to fetch ${label.toLowerCase()}`,
            response: null,
            errors: [{ field: "unknown", message }],
        });
    });

    it("rejects a missing ID variable at the GraphQL boundary", async () => {
        const result = await server.executeOperation(
            { query, variables: {} }, { contextValue: context },
        );
        if (result.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }
        expect(result.body.singleResult.errors).toEqual([
            expect.objectContaining({ message: expect.stringContaining('Variable "$id"') }),
        ]);
        expect(find).not.toHaveBeenCalled();
        expect(mocks.verifyUser).not.toHaveBeenCalled();
    });
});

it("returns null for the optional date of an expense without a stored date", async () => {
    const undatedExpense = { ...expense, date: undefined };
    mocks.findExpense.mockResolvedValue({
        ...undatedExpense,
        toObject: () => undatedExpense,
    });
    const result = await server.executeOperation<{ expenseById: LookupResult }>({
        query: `query { expenseById(_id: "${id}") { success response { _id date } } }`,
    }, { contextValue: context });

    if (result.body.kind !== "single") {
        throw new Error("Expected a single GraphQL response");
    }
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data?.expenseById).toEqual({
        success: true,
        response: { _id: id, date: null },
    });
});
