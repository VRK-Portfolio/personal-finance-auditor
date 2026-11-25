import { GraphQLContext } from "@/graphql/context";
import { IncomeModel } from "@/models/income.model";
import { ApiPostResponse, ApiResponse } from "@/schema/ApiResponse";
import {  CreateIncomeType, getIncomeSchema, GetIncomeType } from "@/schema/income.schema";
import { z } from "zod";

const incomesData: GetIncomeType = [
    {
        _id: "1",
        amount: 100.0,
        source: "Salary",
        date: new Date()
    }
];
export const incomeResolvers = {
    Query: {
        income: async (): Promise<ApiResponse<GetIncomeType | null>> => {
            try {

                const income = await IncomeModel.find();
                const parsedIncome = z.array(getIncomeSchema).parse(income);
                return {
                    success: true,
                    message: "Incomes fetched successfully",
                    response: parsedIncome,
                    errors: null
                }
            } catch (error: Error | unknown) {
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
        addIncome: async (_parent: unknown, args: CreateIncomeType, ctx: GraphQLContext): Promise<ApiPostResponse> => {
            try {
                const addIncome = await IncomeModel.create(args);
                const parsedIncome = getIncomeSchema.parse({
                    ...addIncome.toObject(),
                    _id: addIncome._id.toHexString()
                });
                console.log(parsedIncome);
                return {
                    success: true,
                    message: "Income added successfully",
                    errors: null
                }

            } catch (error: Error | unknown) {
                return {
                    success: false,
                    message: "Failed to add income",
                    errors: error instanceof Error ? [{ field: "unknown", message: error.message }] : [{ field: "unknown", message: "Something went wrong" }],
                }
            }
            
        },
        deleteIncome: (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            const index = incomesData.findIndex(item => item._id === args._id);
            if (index !== -1) {
                const deletedIncome = incomesData.splice(index, 1)[0];
                return deletedIncome;
            }
            return null;
        },

        updateIncome: (_parent: unknown, args: { _id: string, amount?: number, source?: string, date?: Date }, ctx: GraphQLContext) => {
            const index = incomesData.findIndex(item => item._id === args._id);
            if (index !== -1) {
                const updatedIncome = { ...incomesData[index], ...args };
                incomesData[index] = updatedIncome;
                return updatedIncome;
            }
            return null;
        }
    }
}