import { PASSWORD_REGEX } from "@/libs/regex";
import z from "zod";

export const loginSchema = z.object({
    email: z.email().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email address").min(1, "Email is required"),
    password: z.string({ error: "Password is required" }).regex(PASSWORD_REGEX, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character")
});


export const signUpSchema = z.object({
    email: z.email().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email address").min(1, "Email is required"),
    password: z.string({ error: "Password is required" }).regex(PASSWORD_REGEX, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
    confirmPassword: z.string({ error: "Confirm Password is required" }).regex(PASSWORD_REGEX, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character")
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
});
export type loginType = z.infer<typeof loginSchema>;
export type signUpType = z.infer<typeof signUpSchema>;