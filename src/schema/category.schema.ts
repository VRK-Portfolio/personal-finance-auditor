import z from "zod";

export const categoryTypeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    userId: z.string().min(1, "User ID is required")
});

export type CategoryType = z.infer<typeof categoryTypeSchema>;
