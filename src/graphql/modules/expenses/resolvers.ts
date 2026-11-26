import { GraphQLContext } from "@/graphql/context"
import { verifyUser } from "@/libs/verfiy-user"
import { CreateExpenseType, ExpenseSchema } from "@/schema/expense.schema"
import { ExpenseModel } from "@/models/expense.model"
import { FieldError, idSchema } from "@/schema/common"
import { mapFieldErrors } from "@/libs/field-error"
import z from "zod"

export const expensesResolvers = {
    Query: {
        expenseById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return {
                        success: false,
                        message: "Unauthorized",
                        response: null,
                        errors: user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]
                    };
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return {
                        success: false,
                        message: "Invalid expense ID",
                        response: null,
                        errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
                    };
                }
                const expense = await ExpenseModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!expense) {
                    return {
                        success: false,
                        message: "Expense not found",
                        response: null,
                        errors: [{ field: "_id", message: "Expense not found" }]
                    };
                }
                return {
                    success: true,
                    message: "Expense fetched successfully",
                    response: {
                        ...expense.toObject(),
                        _id: expense._id.toHexString(),
                        userId: expense.userId.toHexString(),
                        date: expense.date?.toISOString() ?? null
                    },
                    errors: null
                };
            } catch (error: unknown) {
                return {
                    success: false,
                    message: "Failed to fetch expense",
                    response: null,
                    errors: [{ field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }]
                };
            }
        },
        expenses: async (_parent: unknown, _args: { startDate: string, endDate: string }, ctx: GraphQLContext) => {
            try {
                // Verify the user's authentication token before fetching expenses
                const verifyToken = verifyUser(ctx.authHeader);
                // If the token verification fails, return an error response
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        response: null,
                        errors: verifyToken.errors
                    }
                }

                // Convert the start date to UTC and set the time to the beginning of the day
                const start = new Date(_args?.startDate);
                start.setUTCHours(0, 0, 0, 0);
                // Convert the end date to UTC and set the time to the beginning of the day
                const endExclusive = new Date(_args.endDate);
                endExclusive.setUTCHours(0, 0, 0, 0);
                endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
                // Fetch all income records from the database
                let expense: Awaited<ReturnType<typeof ExpenseModel.find>>;
                // If no start or end date is provided, fetch all expenses for the user
                if (!_args?.startDate || !_args?.endDate) {
                    expense = await ExpenseModel.find({
                        userId: verifyToken._id
                    });
                    return {
                        success: true,
                        message: "Expense fetched successfully",
                        response: expense,
                        errors: null
                    }
                } else {
                    // Fetch expenses within the specified date range for the authenticated user
                    expense = await ExpenseModel.find({
                        userId: verifyToken._id,
                        date: {
                            $gte: start,
                            $lt: endExclusive
                        }
                    });
                }
                // Return the fetched expenses for the authenticated user
                return {
                    success: true,
                    message: "Expenses fetched successfully",
                    response: expense,
                    errors: null
                }
            } catch (error: Error | unknown) {
                // Catch any unexpected errors and return a generic error response
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }

        }
    },
    Mutation: {
        addExpense: async (_parent: unknown, args: { input: CreateExpenseType }, ctx: GraphQLContext) => {
            // Add a new expense for the authenticated user
            try {
                // Verify the user's authentication token
                const verifyToken = verifyUser(ctx.authHeader);
                // If the token verification fails, return an error response
                if (!verifyToken.success) {
                      return {
                        success: false,
                        message: verifyToken.message,
                        response: null,
                        errors: verifyToken.errors
                    }
                } else {
                    // Extract the input data for the new expense
                    const { input } = args;
                    // Create a new expense record in the database
                    const newExpense = await ExpenseModel.create({
                        ...input,
                        date: input.date ?? undefined,
                        userId: verifyToken._id,
                        category: input.category
                    });
                    // Parse and validate the newly created expense using the schema
                    const parseExpense = ExpenseSchema.safeParse({
                        ...newExpense.toObject(),
                        _id: newExpense._id.toHexString()
                    });

                    // If parsing the expense fails, return an error response
                    if(!parseExpense.success) {
                        const {fieldErrors} = z.flattenError(parseExpense.error);
                        const mappedErrors: FieldError[] = mapFieldErrors(fieldErrors);
                        return {
                            success: false,
                            message: "Failed to parse expense",
                            response: null,
                            errors: mappedErrors
                        }
                    }

                    // Return a successful response with the parsed expense data
                    return {
                        success: true,
                        message: "Expense added successfully",
                        response: parseExpense.data,
                        errors: null
                    }
                }
            } catch (error) {
                // Catch any unexpected errors and return a generic error response
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        },
        deleteExpense: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            // Verify the user before attempting to delete an expense
            try {
                // Verify the user before attempting to delete an expense
                const user = await verifyUser(ctx.authHeader);
                // If the user verification fails, return an error response
                if(!user.success) {
                    return {
                        success: false,
                        message: user.message,
                        response: null,
                        errors: user.errors
                    }
                } else {
                    // Proceed with deleting the expense if the user is verified
                    if(!args._id) {
                        return {
                            success: false,
                            message: "Expense ID is required",
                            response: null,
                            errors: [{ field: "Expense ID", message: "Expense ID is required" }]
                        }
                    } else {
                        // Attempt to delete the expense from the database
                        const deletedExpense = await ExpenseModel.findByIdAndDelete(args._id);
                        // If the expense was not found, return an error response
                        if(!deletedExpense) {
                            return {
                                success: false,
                                message: "Expense not found",
                                response: null,
                                errors: [{ field: "Expense ID", message: "Expense not found" }]
                            }
                        }
                        // Return a success response if the expense was deleted successfully
                        return {
                            success: true,
                            message: "Expense deleted successfully",
                            response: deletedExpense,
                            errors: null
                        }
                    }
                }
            } catch (error: Error | unknown) {
                // Catch any unexpected errors and return a generic error response
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        },
        updateExpense: async (_parent: unknown, args: { _id: string, input: CreateExpenseType }, ctx: GraphQLContext) => {
            try {
                const user = await verifyUser(ctx.authHeader);
                if(!user.success) {
                    return {
                        success: false,
                        message: user.message,
                        response: null,
                        errors: user.errors
                    }
                } else {
                    if(!args._id) {
                        return {
                            success: false,
                            message: "Expense ID is required",
                            response: null,
                            errors: [{ field: "Expense ID", message: "Expense ID is required" }]
                        }
                    } else {
                        const updatedExpense = await ExpenseModel.findByIdAndUpdate(
                            args._id,
                            { ...args.input },
                            { new: true }
                        );
                        if(!updatedExpense) {
                            return {
                                success: false,
                                message: "Expense not found",
                                response: null,
                                errors: [{ field: "Expense ID", message: "Expense not found" }]
                            }
                        }
                        return {
                            success: true,
                            message: "Expense updated successfully",
                            response: updatedExpense,
                            errors: null
                        }
                    }
                }

            } catch(error: Error | unknown) {
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        }
    }
}