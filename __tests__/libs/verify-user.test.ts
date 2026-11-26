// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyUser } from "@/libs/verfiy-user";

const mocks = vi.hoisted(() => ({ verifyAccessToken: vi.fn() }));

vi.mock("@/libs/jwt", () => ({ verifyAccessToken: mocks.verifyAccessToken }));

beforeEach(() => {
    vi.resetAllMocks();
});

describe("verifyUser", () => {
    it.each([null, ""])("rejects a missing authorization header without verifying a token", (header) => {
        expect(verifyUser(header)).toEqual({
            success: false,
            message: "Unauthorized",
            errors: [{ field: "authHeader", message: "Authorization header is missing" }],
        });
        expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    });

    it("rejects invalid or expired tokens", () => {
        mocks.verifyAccessToken.mockReturnValue(null);

        expect(verifyUser("invalid-token")).toEqual({
            success: false,
            message: "Unauthorized",
            errors: [{ field: "authHeader", message: "Invalid or expired token" }],
        });
        expect(mocks.verifyAccessToken).toHaveBeenCalledWith("invalid-token");
    });

    it("returns the authenticated user ID for a valid token", () => {
        const userId = "507f1f77bcf86cd799439011";
        mocks.verifyAccessToken.mockReturnValue({ _id: userId });

        expect(verifyUser("valid-token")).toEqual({
            success: true,
            message: "Authorized",
            errors: null,
            _id: userId,
        });
        expect(mocks.verifyAccessToken).toHaveBeenCalledWith("valid-token");
    });
});
