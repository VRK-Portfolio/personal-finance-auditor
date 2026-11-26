// @vitest-environment node

import { describe, expect, it } from "vitest";
import { emailRegex } from "@/libs/regex";

describe("emailRegex", () => {
    it.each(["test@example.com", "test+tag@sub.example.org"])("accepts email %s", (email) => {
        expect(emailRegex.test(email)).toBe(true);
    });

    it.each(["", "test.example.com", "test@localhost", "test@example.c", " test@example.com"])
        ("rejects invalid email %j", (email) => {
            expect(emailRegex.test(email)).toBe(false);
        });
});
