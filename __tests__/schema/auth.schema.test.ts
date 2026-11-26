// @vitest-environment node

import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "@/schema/auth.schema";

const input = {
    email: "test@example.com",
    password: "Secure123!",
    confirmPassword: "Secure123!",
};

describe.each([
    ["login", loginSchema],
    ["signUp", signUpSchema],
] as const)("%s input validation", (_name, schema) => {
    it("accepts valid credentials", () => {
        expect(schema.safeParse(input).success).toBe(true);
    });

    it.each(["", "invalid", "test@example.c"])("rejects invalid email %j", (email) => {
        const result = schema.safeParse({ ...input, email });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({ path: ["email"] }),
            ]));
        }
    });

    it.each([
        "secure123!",
        "SECURE123!",
        "Secureabc!",
        "Secure1234",
        "Aa1!xyz",
        "Aa1!" + "x".repeat(17),
    ])("rejects passwords violating strength or length requirements: %j", (password) => {
        const result = schema.safeParse({ ...input, password, confirmPassword: password });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({ path: ["password"] }),
            ]));
        }
    });

    it.each(["Aa1!xxxx", "Aa1!" + "x".repeat(16)])("accepts a password at a length boundary", (password) => {
        expect(schema.safeParse({ ...input, password, confirmPassword: password }).success).toBe(true);
    });
});

describe("signUp confirmation", () => {
    it("reports mismatched passwords on the confirmation field", () => {
        const result = signUpSchema.safeParse({ ...input, confirmPassword: "Different123!" });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues).toContainEqual(expect.objectContaining({
                path: ["confirmPassword"],
                message: "Passwords do not match",
            }));
        }
    });

    it("requires password confirmation", () => {
        expect(signUpSchema.safeParse({
            email: input.email,
            password: input.password,
        }).success).toBe(false);
    });
});
