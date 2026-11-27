import z from "zod";
import { idSchema, positiveAmountSchema } from "./common";

export const createExpenseInputSchema = z.object({
    amount: positiveAmountSchema,
    category: idSchema,
    date: z.union([z.iso.date(), z.iso.datetime({ offset: true })])
        .transform(value => new Date(value)),
    merchant: z.string().nullish(),
    description: z.string().nullish()
});

export const updateExpenseInputSchema = createExpenseInputSchema.partial().refine(
    input => Object.values(input).some(value => value !== undefined),
    { message: "At least one expense field is required", path: ["input"] }
);

export const ExpenseSchema = createExpenseInputSchema.extend({
    date: z.date().optional().default(() => new Date()),
    userId: idSchema
});

export const updateExpenseSchema = ExpenseSchema.partial().extend({
    _id: idSchema
});

export const deleteExpenseSchema = z.object({
    _id: idSchema
});

export const getExpenseSchema = z.object({
    _id: idSchema
});

export type CreateExpenseType = z.infer<typeof ExpenseSchema>;
export type UpdateExpenseType = z.infer<typeof updateExpenseSchema>;
export type DeleteExpenseType = z.infer<typeof deleteExpenseSchema>;
export type GetExpenseType = z.infer<typeof getExpenseSchema>;