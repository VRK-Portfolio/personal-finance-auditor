import { z } from "zod";
import { idSchema, positiveAmountSchema } from "./common";
import { Types } from "mongoose";

export const createIncomeInputSchema = z.object({
  source: z.string().min(1),
  amount: positiveAmountSchema.nonoptional("Amount is required"),
  date: z.date().optional().default(new Date()),
  userId: idSchema
});

export const updateIncomeInputSchema = createIncomeInputSchema.partial().extend({
    _id: idSchema
});


export const deleteIncomeInputSchema = z.object({
  _id: idSchema
});


export const getIncomeSchema = createIncomeInputSchema.extend({
  _id: idSchema
});

export type CreateIncomeType = z.infer<typeof createIncomeInputSchema>;
export type UpdateIncomeType = z.infer<typeof updateIncomeInputSchema>;
export type DeleteIncomeType = z.infer<typeof deleteIncomeInputSchema>;
export type GetIncomeType = z.infer<typeof getIncomeSchema>[];