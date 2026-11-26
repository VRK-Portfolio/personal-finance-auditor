import z from "zod";
import { idSchema } from "./common";

export const ExpenseSchema = z.object({
    amount: z.number().min(1, "Amount must be at least 1"),
    description: z.string().optional(),
    date: z.date().optional().default(new Date()),
    userId: idSchema,
    category: idSchema,
    merchant: idSchema.optional()
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