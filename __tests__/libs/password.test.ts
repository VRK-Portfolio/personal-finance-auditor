// @vitest-environment node

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/libs/password";

describe("password helpers", () => {
    it("hashes passwords and verifies the original password", async () => {
        const password = "Secure123!";
        const hash = await hashPassword(password);

        expect(hash).not.toBe(password);
        expect(await verifyPassword(password, hash)).toBe(true);
        expect(await verifyPassword("Different123!", hash)).toBe(false);
    });

    it("uses a unique salt when hashing the same password", async () => {
        const [first, second] = await Promise.all([
            hashPassword("Secure123!"),
            hashPassword("Secure123!"),
        ]);

        expect(first).not.toBe(second);
        expect(await verifyPassword("Secure123!", first)).toBe(true);
        expect(await verifyPassword("Secure123!", second)).toBe(true);
    });

    it("rejects an empty stored hash", async () => {
        expect(await verifyPassword("Secure123!", "")).toBe(false);
    });
});
