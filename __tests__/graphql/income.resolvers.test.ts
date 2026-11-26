// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import { incomeResolvers } from "@/graphql/modules/income/resolvers";
import { incomeTypeDefs } from "@/graphql/modules/income/typeDefs";
import type { ApiPostResponse, ApiResponse } from "@/schema/ApiResponse";
import type { GetIncomeType } from "@/schema/income.schema";

const mocks = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn() }));

vi.mock("@/models/income.model", () => ({
    IncomeModel: { find: mocks.find, create: mocks.create },
}));

const id = "507f1f77bcf86cd799439011";
const date = new Date("2026-01-01T00:00:00.000Z");
const income = { _id: id, amount: 2500, source: "Salary", date };
const context: GraphQLContext = { authHeader: null };
const server = new ApolloServer<GraphQLContext>({
    typeDefs: incomeTypeDefs,
    resolvers: incomeResolvers,
});

beforeAll(async () => {
    await server.start();
});

afterAll(async () => {
    await server.stop();
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.find.mockResolvedValue([income]);
    mocks.create.mockResolvedValue({
        _id: { toHexString: () => id },
        toObject: () => income,
    });
});

describe("income query", () => {
    it("returns validated income records through GraphQL", async () => {
        const response = await server.executeOperation<{
            income: { success: boolean; response: { _id: string; amount: number; source: string }[] };
        }>({
            query: "{ income { success message response { _id amount source } } }",
        }, { contextValue: context });

        if (response.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.income).toEqual({
            success: true,
            message: "Incomes fetched successfully",
            response: [{ _id: id, amount: income.amount, source: income.source }],
        });
    });

    it("returns an empty list when no incomes exist", async () => {
        mocks.find.mockResolvedValue([]);

        expect(await incomeResolvers.Query.income()).toEqual({
            success: true,
            message: "Incomes fetched successfully",
            response: [],
            errors: null,
        });
    });

    it("normalizes MongoDB ObjectIds in returned records", async () => {
        const { Types } = await import("mongoose");
        mocks.find.mockResolvedValue([{ ...income, _id: new Types.ObjectId(id) }]);

        const result = await incomeResolvers.Query.income();

        expect(result.success).toBe(true);
        expect(result.response?.[0]._id).toBe(id);
    });

    it("returns a validation failure for invalid database records", async () => {
        mocks.find.mockResolvedValue([{ ...income, amount: -1 }]);

        const result = await incomeResolvers.Query.income();

        expect(result.success).toBe(false);
        expect(result.response).toBeNull();
        expect(result.errors).toEqual([
            { field: "unknown", message: expect.any(String) },
        ]);
    });

    it.each([
        [new Error("Database unavailable"), "Database unavailable"],
        ["unexpected rejection", "Something went wrong"],
    ])("returns an explicit failure for database errors", async (error, message) => {
        mocks.find.mockRejectedValue(error);

        const result: ApiResponse<GetIncomeType | null> = await incomeResolvers.Query.income();

        expect(result).toEqual({
            success: false,
            message: "Failed to fetch incomes",
            response: null,
            errors: [{ field: "unknown", message }],
        });
    });
});

describe("addIncome mutation", () => {
    it("creates income through GraphQL and returns success", async () => {
        const response = await server.executeOperation<{ addIncome: ApiPostResponse }>({
            query: `
                mutation AddIncome($amount: Float!, $source: String!) {
                    addIncome(amount: $amount, source: $source) { success message }
                }
            `,
            variables: { amount: income.amount, source: income.source },
        }, { contextValue: context });

        if (response.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.addIncome).toEqual({
            success: true,
            message: "Income added successfully",
        });
        expect(mocks.create).toHaveBeenCalledWith({
            amount: income.amount,
            source: income.source,
        });
    });

    it("returns a failure if the created document fails validation", async () => {
        mocks.create.mockResolvedValue({
            _id: { toHexString: () => id },
            toObject: () => ({ ...income, amount: 0 }),
        });

        const result = await incomeResolvers.Mutation.addIncome(undefined, income, context);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Failed to add income");
        expect(result.errors?.[0]).toEqual({
            field: "unknown",
            message: expect.any(String),
        });
    });

    it.each([
        [new Error("Insert failed"), "Insert failed"],
        ["unexpected rejection", "Something went wrong"],
    ])("returns an explicit failure when creation throws", async (error, message) => {
        mocks.create.mockRejectedValue(error);

        expect(await incomeResolvers.Mutation.addIncome(undefined, income, context)).toEqual({
            success: false,
            message: "Failed to add income",
            errors: [{ field: "unknown", message }],
        });
    });
});

describe("in-memory income mutations", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("updates an existing income while preserving unspecified fields", async () => {
        const { incomeResolvers: isolatedResolvers } = await import("@/graphql/modules/income/resolvers");

        const updated = isolatedResolvers.Mutation.updateIncome(
            undefined, { _id: "1", amount: 200 }, context,
        );

        expect(updated).toEqual({
            _id: "1",
            amount: 200,
            source: "Salary",
            date: expect.any(Date),
        });
        expect(isolatedResolvers.Mutation.deleteIncome(undefined, { _id: "1" }, context)).toEqual(updated);
    });

    it("returns null when updating an unknown income", async () => {
        const { incomeResolvers: isolatedResolvers } = await import("@/graphql/modules/income/resolvers");

        expect(isolatedResolvers.Mutation.updateIncome(
            undefined, { _id: "missing", source: "Other" }, context,
        )).toBeNull();
    });

    it("deletes an income only once", async () => {
        const { incomeResolvers: isolatedResolvers } = await import("@/graphql/modules/income/resolvers");

        expect(isolatedResolvers.Mutation.deleteIncome(undefined, { _id: "1" }, context)).toMatchObject({
            _id: "1",
            amount: 100,
            source: "Salary",
        });
        expect(isolatedResolvers.Mutation.deleteIncome(undefined, { _id: "1" }, context)).toBeNull();
    });

    it("returns null when deleting an unknown income", async () => {
        const { incomeResolvers: isolatedResolvers } = await import("@/graphql/modules/income/resolvers");

        expect(isolatedResolvers.Mutation.deleteIncome(undefined, { _id: "missing" }, context)).toBeNull();
    });
});
