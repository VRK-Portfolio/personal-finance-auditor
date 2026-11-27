import type { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { verifyUser } from "@/libs/verfiy-user";
import { CategoryModel } from "@/models/category.model";
import { ExpenseModel } from "@/models/expense.model";
import { FieldError, idSchema } from "@/schema/common";
import { createExpenseInputSchema, updateExpenseInputSchema } from "@/schema/expense.schema";
import { z } from "zod";

type ExpenseInput = {
    amount: number;
    category: string;
    date?: string | null;
    merchant?: string | null;
    description?: string | null;
};

type UpdateExpenseInput = Omit<Partial<ExpenseInput>, "amount" | "category"> & {
    amount?: number | null;
    category?: string | null;
};

function failure(message: string, errors: FieldError[]) {
    return { success: false, message, response: null, errors };
}

function serializeExpense(expense: NonNullable<Awaited<ReturnType<typeof ExpenseModel.findOne>>>) {
    return {
        _id: expense._id.toHexString(),
        userId: expense.userId.toHexString(),
        amount: expense.amount,
        category: idSchema.parse(expense.category),
        date: expense.date?.toISOString() ?? null,
        merchant: expense.merchant ?? null,
        description: expense.description ?? null
    };
}

export const expensesResolvers = {
    Query: {
        expenseById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid expense ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const expense = await ExpenseModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!expense) {
                    return failure("Expense not found", [{ field: "_id", message: "Expense not found" }]);
                }
                return {
                    success: true, message: "Expense fetched successfully",
                    response: serializeExpense(expense), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch expense", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        expenses: async (_parent: unknown, args: { startDate?: string | null; endDate?: string | null }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                let expenses: Awaited<ReturnType<typeof ExpenseModel.find>>;
                if (!args.startDate || !args.endDate) {
                    expenses = await ExpenseModel.find({ userId: user._id });
                } else {
                    const dateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
                    const range = z.object({ startDate: dateSchema, endDate: dateSchema }).safeParse(args);
                    if (!range.success) {
                        return failure("Invalid expense date range", mapFieldErrors(z.flattenError(range.error).fieldErrors));
                    }
                    const start = new Date(range.data.startDate);
                    start.setUTCHours(0, 0, 0, 0);
                    const endExclusive = new Date(range.data.endDate);
                    endExclusive.setUTCHours(0, 0, 0, 0);
                    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
                    if (start >= endExclusive) {
                        return failure("Invalid expense date range", [
                            { field: "endDate", message: "End date must not be before start date" }
                        ]);
                    }
                    expenses = await ExpenseModel.find({
                        userId: user._id, date: { $gte: start, $lt: endExclusive }
                    });
                }
                return {
                    success: true, message: "Expenses fetched successfully",
                    response: expenses.map(serializeExpense), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch expenses", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    },
    Mutation: {
        addExpense: async (_parent: unknown, args: { input: ExpenseInput }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const input = createExpenseInputSchema.safeParse({
                    ...args.input, date: args.input.date ?? new Date().toISOString()
                });
                if (!input.success) {
                    return failure("Invalid expense input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const category = await CategoryModel.findOne({ _id: input.data.category, userId: user._id });
                if (!category) {
                    return failure("Category not found", [{ field: "category", message: "Category not found" }]);
                }
                const expense = await ExpenseModel.create({ ...input.data, userId: user._id });
                return {
                    success: true, message: "Expense added successfully",
                    response: serializeExpense(expense), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to add expense", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        updateExpense: async (_parent: unknown, args: { _id: string; input: UpdateExpenseInput }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid expense ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const input = updateExpenseInputSchema.safeParse(args.input);
                if (!input.success) {
                    return failure("Invalid expense input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                if (input.data.category !== undefined) {
                    const category = await CategoryModel.findOne({ _id: input.data.category, userId: user._id });
                    if (!category) {
                        return failure("Category not found", [{ field: "category", message: "Category not found" }]);
                    }
                }
                const changes = Object.fromEntries(Object.entries(input.data).filter(([, value]) => value !== undefined));
                const expense = await ExpenseModel.findOneAndUpdate(
                    { _id: parsedId.data, userId: user._id },
                    { $set: changes },
                    { new: true, runValidators: true }
                );
                if (!expense) {
                    return failure("Expense not found", [{ field: "_id", message: "Expense not found" }]);
                }
                return {
                    success: true, message: "Expense updated successfully",
                    response: serializeExpense(expense), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to update expense", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        deleteExpense: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid expense ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const expense = await ExpenseModel.findOneAndDelete({ _id: parsedId.data, userId: user._id });
                if (!expense) {
                    return failure("Expense not found", [{ field: "_id", message: "Expense not found" }]);
                }
                return {
                    success: true, message: "Expense deleted successfully",
                    response: serializeExpense(expense), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to delete expense", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    }
};
