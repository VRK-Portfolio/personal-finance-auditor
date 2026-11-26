// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import { incomeResolvers } from "@/graphql/modules/income/resolvers";
import { incomeTypeDefs } from "@/graphql/modules/income/typeDefs";
import type { ApiPostResponse, ApiResponse } from "@/schema/ApiResponse";
import type { GetIncomeType } from "@/schema/income.schema";

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    verifyUser: vi.fn(),
}));

vi.mock("@/models/income.model", () => ({
    IncomeModel: {
        find: mocks.find,
        create: mocks.create,
        findByIdAndDelete: mocks.findByIdAndDelete,
        findByIdAndUpdate: mocks.findByIdAndUpdate,
    },
}));

vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

const id = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const date = new Date("2026-01-01T00:00:00.000Z");
const income = { _id: id, amount: 2500, source: "Salary", date, userId };
const document = {
    _id: new Types.ObjectId(id),
    toObject: () => ({
        ...income,
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
    }),
};
const context: GraphQLContext = { authHeader: "valid-token" };
const emptyDateRange = { startDate: "", endDate: "" };
const server = new ApolloServer<GraphQLContext>({
    typeDefs: incomeTypeDefs,
    resolvers: incomeResolvers,
});

function fetchIncome(args = emptyDateRange) {
    return incomeResolvers.Query.income(undefined, args, context);
}

beforeAll(async () => {
    await server.start();
});

afterAll(async () => {
    await server.stop();
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.find.mockResolvedValue([income]);
    mocks.create.mockResolvedValue(document);
    mocks.findByIdAndDelete.mockResolvedValue(document);
    mocks.findByIdAndUpdate.mockResolvedValue(document);
    mocks.verifyUser.mockReturnValue({
        success: true, message: "Authorized", errors: null, _id: userId,
    });
});

describe.each(["income", "addIncome", "deleteIncome", "updateIncome"] as const)(
    "%s authorization",
    (operation) => {
        it("rejects unauthorized users before accessing the database", async () => {
            const denied = {
                success: false,
                message: "Unauthorized",
                errors: [{ field: "authHeader", message: "Invalid or expired token" }],
            };
            mocks.verifyUser.mockReturnValue(denied);
            const operations = {
                income: () => fetchIncome(),
                addIncome: () => incomeResolvers.Mutation.addIncome(undefined, income, context),
                deleteIncome: () => incomeResolvers.Mutation.deleteIncome(undefined, { _id: id }, context),
                updateIncome: () => incomeResolvers.Mutation.updateIncome(undefined, { _id: id }, context),
            };

            expect(await operations[operation]()).toMatchObject(denied);
            expect(mocks.verifyUser).toHaveBeenCalledWith(context.authHeader);
            expect(mocks.find).not.toHaveBeenCalled();
            expect(mocks.create).not.toHaveBeenCalled();
            expect(mocks.findByIdAndDelete).not.toHaveBeenCalled();
            expect(mocks.findByIdAndUpdate).not.toHaveBeenCalled();
        });
    },
);

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
        expect(mocks.find).toHaveBeenCalledWith({ userId });
    });

    it("returns an empty list when no incomes exist", async () => {
        mocks.find.mockResolvedValue([]);

        expect(await fetchIncome()).toEqual({
            success: true,
            message: "Incomes fetched successfully",
            response: [],
            errors: null,
        });
    });

    it("normalizes MongoDB ObjectIds in returned records", async () => {
        mocks.find.mockResolvedValue([document.toObject()]);

        const result = await fetchIncome();

        expect(result.success).toBe(true);
        expect(result.response?.[0]._id).toBe(id);
        expect(result.response?.[0].userId).toBe(userId);
    });

    it("filters by the authenticated user and UTC date boundaries", async () => {
        await fetchIncome({
            startDate: "2026-01-01T12:34:56Z",
            endDate: "2026-01-31T23:59:59Z",
        });

        expect(mocks.find).toHaveBeenCalledWith({
            userId,
            date: {
                $gte: new Date("2026-01-01T00:00:00Z"),
                $lte: new Date("2026-02-01T00:00:00Z"),
            },
        });
    });

    it.each([
        { startDate: "", endDate: "" },
        { startDate: "2026-01-01", endDate: "" },
        { startDate: "", endDate: "2026-01-31" },
    ])("omits date filtering when either boundary is absent: %j", async (args) => {
        await fetchIncome(args);

        expect(mocks.find).toHaveBeenCalledWith({ userId });
    });

    it("returns a validation failure for invalid database records", async () => {
        mocks.find.mockResolvedValue([{ ...income, amount: -1 }]);

        const result = await fetchIncome();

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

        const result: ApiResponse<GetIncomeType | null> = await fetchIncome();

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
            date: undefined,
            userId,
        });
    });

    it.each([null, undefined])("uses the database date default for an absent date: %j", async (dateInput) => {
        const response = await server.executeOperation<{ addIncome: ApiPostResponse }>({
            query: `
                mutation AddIncome($date: String) {
                    addIncome(amount: 100, source: "Salary", date: $date) { success }
                }
            `,
            variables: { date: dateInput },
        }, { contextValue: context });

        if (response.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }
        expect(response.body.singleResult.errors).toBeUndefined();
        expect(response.body.singleResult.data?.addIncome.success).toBe(true);
        expect(mocks.create).toHaveBeenCalledWith({
            amount: 100, source: "Salary", date: undefined, userId,
        });
    });

    it("uses the authenticated user ID instead of a supplied user ID", async () => {
        const result = await incomeResolvers.Mutation.addIncome(undefined, {
            ...income, userId: "507f1f77bcf86cd799439013",
        }, context);

        expect(result.success).toBe(true);
        expect(mocks.create).toHaveBeenCalledWith({
            ...income, userId,
        });
    });

    it("returns a failure if the created document fails validation", async () => {
        mocks.create.mockResolvedValue({
            _id: { toHexString: () => id },
            toObject: () => ({ ...income, amount: 0 }),
        });

        const result = await incomeResolvers.Mutation.addIncome(undefined, income, context);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Failed to parse income");
        expect(result.errors?.[0]).toEqual({
            field: "amount",
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

describe("updateIncome mutation", () => {
    it("updates an existing income while preserving unspecified fields", async () => {
        mocks.findByIdAndUpdate.mockResolvedValue({
            ...document,
            toObject: () => ({ ...document.toObject(), amount: 200 }),
        });
        const updated = await incomeResolvers.Mutation.updateIncome(
            undefined, { _id: id, amount: 200 }, context,
        );

        expect(updated).toEqual({
            success: true,
            message: "Income updated successfully",
            errors: null,
            response: { ...income, amount: 200 },
        });
        expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
            id, { $set: { _id: id, amount: 200 } }, { new: true },
        );
    });

    it("returns a failure when updating an unknown income", async () => {
        mocks.findByIdAndUpdate.mockResolvedValue(null);

        expect(await incomeResolvers.Mutation.updateIncome(
            undefined, { _id: id, source: "Other" }, context,
        )).toEqual({
            success: false,
            message: "Income not found",
            errors: [{ field: "unknown", message: "Income not found" }],
            response: null,
        });
    });
});

describe("deleteIncome mutation", () => {
    it("returns the deleted income with normalized IDs", async () => {
        expect(await incomeResolvers.Mutation.deleteIncome(undefined, { _id: id }, context)).toEqual({
            success: true,
            message: "Income deleted successfully",
            errors: null,
            response: income,
        });
        expect(mocks.findByIdAndDelete).toHaveBeenCalledWith(id);
    });

    it("returns a failure when deleting an unknown income", async () => {
        mocks.findByIdAndDelete.mockResolvedValue(null);

        expect(await incomeResolvers.Mutation.deleteIncome(undefined, { _id: id }, context)).toEqual({
            success: false,
            message: "Income not found",
            errors: [{ field: "unknown", message: "Income not found" }],
            response: null,
        });
    });
});

describe.each(["deleteIncome", "updateIncome"] as const)("%s errors", (operation) => {
    it.each([
        [new Error("Database unavailable"), "Database unavailable"],
        ["unexpected rejection", "Something went wrong"],
    ])("returns an explicit failure when the database throws", async (error, message) => {
        const databaseMethod = operation === "deleteIncome" ? mocks.findByIdAndDelete : mocks.findByIdAndUpdate;
        databaseMethod.mockRejectedValue(error);

        expect(await incomeResolvers.Mutation[operation](undefined, { _id: id }, context)).toEqual({
            success: false,
            message: operation === "deleteIncome" ? "Failed to delete income" : "Failed to update income",
            errors: [{ field: "unknown", message }],
            response: null,
        });
    });

    it("returns a failure if the database document is invalid", async () => {
        const databaseMethod = operation === "deleteIncome" ? mocks.findByIdAndDelete : mocks.findByIdAndUpdate;
        databaseMethod.mockResolvedValue({
            ...document,
            toObject: () => ({ ...document.toObject(), amount: -1 }),
        });

        expect(await incomeResolvers.Mutation[operation](undefined, { _id: id }, context)).toMatchObject({
            success: false,
            response: null,
            errors: [{ field: "unknown", message: expect.any(String) }],
        });
    });
});
