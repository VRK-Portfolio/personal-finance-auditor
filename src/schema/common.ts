import mongoose from "mongoose";
import { z } from "zod";

export const idSchema = z
  .union([z.string(), z.instanceof(mongoose.Types.ObjectId)])
  .refine(value => mongoose.isObjectIdOrHexString(value), {
    message: "Invalid MongoDB ObjectId",
  })
  .transform(value => value.toString());;

export const positiveAmountSchema = z.number().positive("Amount must be greater than zero").min(1);

export const FieldErrorSchema = z.object({
  field: z.string(),
  message: z.string()
});

export type FieldError = z.infer<typeof FieldErrorSchema>;