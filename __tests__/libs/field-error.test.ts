// @vitest-environment node

import { describe, expect, it } from "vitest";
import { mapFieldErrors } from "@/libs/field-error";

describe("mapFieldErrors", () => {
    it("maps each field to its first validation message", () => {
        expect(mapFieldErrors({
            email: ["Invalid email", "Email required"],
            password: ["Password too weak"],
        })).toEqual([
            { field: "email", message: "Invalid email" },
            { field: "password", message: "Password too weak" },
        ]);
    });

    it("returns an empty list when there are no field errors", () => {
        expect(mapFieldErrors({})).toEqual([]);
    });
});
