import { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { verifyUser } from "@/libs/verfiy-user";
import { IncomeModel } from "@/models/income.model";
import { ApiPostResponse, ApiResponse } from "@/schema/ApiResponse";
import { FieldError, idSchema } from "@/schema/common";
import {  CreateIncomeType, getIncomeSchema, GetIncomeType } from "@/schema/income.schema";
import { z } from "zod";

export const incomeResolvers = {
    Query: {
        incomeById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
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
                        message: "Invalid income ID",
                        response: null,
                        errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
                    };
                }
                const income = await IncomeModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!income) {
                    return {
                        success: false,
                        message: "Income not found",
                        response: null,
                        errors: [{ field: "_id", message: "Income not found" }]
                    };
                }
                return {
                    success: true,
                    message: "Income fetched successfully",
                    response: {
                        ...income.toObject(),
                        _id: income._id.toHexString(),
                        date: income.date.toISOString()
                    },
                    errors: null
                };
            } catch (error: unknown) {
                return {
                    success: false,
                    message: "Failed to fetch income",
                    response: null,
                    errors: [{ field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }]
                };
            }
        },
        income: async (_parent: unknown, _args: { startDate: string, endDate: string }, ctx: GraphQLContext): Promise<ApiResponse<GetIncomeType | null>> => {
            try {
                const verifyToken = verifyUser(ctx.authHeader);
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        errors: verifyToken.errors,
                        response: null
                    }
                }
                // Convert the start date to UTC and set the time to the beginning of the day
                const start = new Date(_args.startDate);
                start.setUTCHours(0, 0, 0, 0);
                // Convert the end date to UTC and set the time to the beginning of the day
                const endExclusive = new Date(_args.endDate);
                endExclusive.setUTCHours(0, 0, 0, 0);
                endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
                // Fetch all income records from the database
                let income: Awaited<ReturnType<typeof IncomeModel.find>>;
                if (!_args.startDate || !_args.endDate) {
                    income = await IncomeModel.find({
                        userId: verifyToken._id
                    });
                } else {

                    income = await IncomeModel.find({
                        userId: verifyToken._id,
                        date: {
                            $gte: start,
                            $lte: endExclusive
                        }
                    });
                }
                const parsedIncome = z.array(getIncomeSchema).parse(income);
                // Parse the fetched income records to ensure they match the expected schema
                return {
                    success: true,
                    message: "Incomes fetched successfully",
                    response: parsedIncome,
                    errors: null
                }
            } catch (error: Error | unknown) {
                // Handle errors that occur during fetching or parsing income records
                return {
                    success: false,
                    message: "Failed to fetch incomes",
                    errors: error instanceof Error ? [{ field: "unknown", message: error.message }] : [{ field: "unknown", message: "Something went wrong" }],
                    response: null
                }
            }

        }
    },
    Mutation: {
        addIncome: async (_parent: unknown, args: {input: CreateIncomeType}, ctx: GraphQLContext): Promise<ApiPostResponse> => {
            try {
                // Check if the authorization header is present in the request context
                const verifyToken = verifyUser(ctx.authHeader);
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        errors: verifyToken.errors
                    }
                }

                const userId = verifyToken._id;
                const { input } = args;
                // Create a new income record in the database
                const addIncome = await IncomeModel.create({
                    ...input,
                    date: input.date ?? undefined,
                    userId: userId
                });
                const parsedIncome = getIncomeSchema.safeParse({
                    ...addIncome.toObject(),
                    _id: addIncome._id.toHexString()
                });
                // If parsing fails, return an error response
                if(!parsedIncome.success) {
                    const {fieldErrors} = z.flattenError(parsedIncome.error);
                    const mappedErrors: FieldError[] = mapFieldErrors(fieldErrors);
                    return {
                        success: false,
                        message: "Failed to parse income",
                        errors: mappedErrors
                    }
                }
                // Return a successful response indicating the income was added
                return {
                    success: true,
                    message: "Income added successfully",
                    errors: null
                }

            } catch (error: Error | unknown) {
                // Handle errors that occur during income creation
                return {
                    success: false,
                    message: "Failed to add income",
                    errors: error instanceof Error ? [{ field: "unknown", message: error.message }] : [{ field: "unknown", message: "Something went wrong" }],
                }
            }
            
        },
        deleteIncome: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                // Verify the user's authentication token
                const verifyToken = verifyUser(ctx.authHeader);
                // If token verification fails, return an error response
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        errors: verifyToken.errors,
                        response: null
                    }
                }
                // Attempt to delete the income record by its ID
                const deletedIncome = await IncomeModel.findByIdAndDelete(args._id);
                if (!deletedIncome) {
                    return {
                        success: false,
                        message: "Income not found",
                        errors: [{ field: "unknown", message: "Income not found" }],
                        response: null
                    }
                }
                return {
                    success: true,
                    message: "Income deleted successfully",
                    errors: null,
                    response: getIncomeSchema.parse({
                        ...deletedIncome.toObject(),
                        _id: deletedIncome._id.toHexString()
                    })
                };
            } catch (error: Error | unknown) {
                return {
                    success: false,
                    message: "Failed to delete income",
                    errors: error instanceof Error ? [{ field: "unknown", message: error.message }] : [{ field: "unknown", message: "Something went wrong" }],
                    response: null
                }
            }
        },

        updateIncome: async (_parent: unknown, args: { _id: string, amount?: number, source?: string, date?: Date }, ctx: GraphQLContext) => {
            try {
                const verifyToken = verifyUser(ctx.authHeader);
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        errors: verifyToken.errors,
                        response: null
                    }
                }

                const updatedIncome = await IncomeModel.findByIdAndUpdate(
                    args._id,
                    { $set: args },
                    { new: true }
                );
                if (!updatedIncome) {
                    return {
                        success: false,
                        message: "Income not found",
                        errors: [{ field: "unknown", message: "Income not found" }],
                        response: null
                    }
                }
                return {
                    success: true,
                    message: "Income updated successfully",
                    errors: null,
                    response: getIncomeSchema.parse({
                        ...updatedIncome.toObject(),
                        _id: updatedIncome._id.toHexString()
                    })
                };
            } catch (error: Error | unknown) {
                return {
                    success: false,
                    message: "Failed to update income",
                    errors: error instanceof Error ? [{ field: "unknown", message: error.message }] : [{ field: "unknown", message: "Something went wrong" }],
                    response: null
                }
            }
        }
    }
}