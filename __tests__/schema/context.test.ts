// @vitest-environment node

import { describe, expect, it } from "vitest";
import { commonContextSchema } from "@/schema/context";

describe("context validation", () => {
    it("accepts an authorization string or explicit null", () => {
        expect(commonContextSchema.parse({ authHeader: "test-token" })).toEqual({
            authHeader: "test-token",
        });
        expect(commonContextSchema.parse({ authHeader: null })).toEqual({ authHeader: null });
    });

    it.each([{}, { authHeader: 123 }, { authHeader: undefined }])("rejects invalid context %j", (context) => {
        expect(commonContextSchema.safeParse(context).success).toBe(false);
    });
});
