import z from "zod";
import { idSchema } from "./common";

export const categoryTypeSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    userId: idSchema
});

export type CategoryType = z.infer<typeof categoryTypeSchema>;
