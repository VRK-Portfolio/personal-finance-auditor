import z from "zod";

export const commonContextSchema = z.object({
    authHeader: z.string().nullable()
})

export type CommonContextType = z.infer<typeof commonContextSchema>;