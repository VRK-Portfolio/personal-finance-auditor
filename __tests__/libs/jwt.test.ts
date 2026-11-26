// @vitest-environment node

import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const accessSecret = "unit-test-access-key";
const refreshSecret = "unit-test-refresh-key";
const userId = "507f1f77bcf86cd799439011";
let helpers: typeof import("@/libs/jwt");

beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("JWT_ACCESS_SECRET", accessSecret);
    vi.stubEnv("JWT_REFRESH_SECRET", refreshSecret);
    helpers = await import("@/libs/jwt");
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe("access tokens", () => {
    it("signs the user ID as the access token subject and verifies it", () => {
        const token = helpers.signAccessToken({ _id: userId });
        const decoded = jwt.verify(token, accessSecret);

        expect(decoded).toMatchObject({
            _id: userId,
            sub: userId,
            tokenType: "access",
        });
        expect(helpers.verifyAccessToken(token)).toEqual({ _id: userId });
    });

    it("normalizes the user ID when verifying claims", () => {
        const token = jwt.sign({ _id: ` ${userId.toUpperCase()} `, tokenType: "access" }, accessSecret);

        expect(helpers.verifyAccessToken(token)).toEqual({ _id: userId });
    });

    it("expires access tokens after fifteen minutes", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const token = helpers.signAccessToken({ _id: userId });

        vi.setSystemTime(new Date("2026-01-01T00:14:59Z"));
        expect(helpers.verifyAccessToken(token)).toEqual({ _id: userId });
        vi.setSystemTime(new Date("2026-01-01T00:15:00Z"));
        expect(helpers.verifyAccessToken(token)).toBeNull();
    });

    it("rejects malformed tokens and tokens signed with another secret", () => {
        expect(helpers.verifyAccessToken("not-a-jwt")).toBeNull();
        expect(helpers.verifyAccessToken(jwt.sign({
            _id: userId, tokenType: "access",
        }, "different-test-key"))).toBeNull();
    });

    it.each([
        { _id: userId, tokenType: "refresh" },
        { tokenType: "access" },
        { _id: "", tokenType: "access" },
        { _id: 123, tokenType: "access" },
    ])("rejects access tokens with invalid claims: %j", (payload) => {
        expect(helpers.verifyAccessToken(jwt.sign(payload, accessSecret))).toBeNull();
    });

    it("rejects a signed string payload", () => {
        expect(helpers.verifyAccessToken(jwt.sign("test@example.com", accessSecret))).toBeNull();
    });

    it("throws when signing without an access secret and rejects verification", async () => {
        const token = helpers.signAccessToken({ _id: userId });
        vi.stubEnv("JWT_ACCESS_SECRET", "");
        vi.resetModules();
        const withoutSecret = await import("@/libs/jwt");

        expect(() => withoutSecret.signAccessToken({ _id: userId }))
            .toThrow("Missing JWT_ACCESS_SECRET environment variable");
        expect(withoutSecret.verifyAccessToken(token)).toBeNull();
    });
});

describe("refresh tokens", () => {
    it("signs normalized refresh claims with a seven-day lifetime", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const token = helpers.signRefreshToken({ email: " TEST@EXAMPLE.COM " });

        expect(jwt.verify(token, refreshSecret)).toMatchObject({
            email: "test@example.com",
            sub: "test@example.com",
            tokenType: "refresh",
        });
        vi.setSystemTime(new Date("2026-01-07T23:59:59Z"));
        expect(() => jwt.verify(token, refreshSecret)).not.toThrow();
        vi.setSystemTime(new Date("2026-01-08T00:00:00Z"));
        expect(() => jwt.verify(token, refreshSecret)).toThrow("jwt expired");
    });

    it("verifies refresh tokens with a numeric tokenVersion", () => {
        const token = jwt.sign({
            email: " TEST@EXAMPLE.COM ",
            tokenType: "refresh",
            tokenVersion: 1,
        }, refreshSecret);

        expect(helpers.verifyRefreshToken(token)).toEqual({ email: "test@example.com" });
    });

    it.each([
        { email: "test@example.com", tokenType: "access", tokenVersion: 1 },
        { email: "test@example.com", tokenType: "refresh" },
        { email: "test@example.com", tokenType: "refresh", tokenVersion: "1" },
        { email: "", tokenType: "refresh", tokenVersion: 1 },
        { tokenType: "refresh", tokenVersion: 1 },
    ])("rejects refresh tokens with invalid claims: %j", (payload) => {
        expect(helpers.verifyRefreshToken(jwt.sign(payload, refreshSecret))).toBeNull();
    });

    it("rejects malformed, string, expired, and incorrectly signed refresh tokens", () => {
        const payload = { email: "test@example.com", tokenType: "refresh", tokenVersion: 1 };

        expect(helpers.verifyRefreshToken("not-a-jwt")).toBeNull();
        expect(helpers.verifyRefreshToken(jwt.sign("test@example.com", refreshSecret))).toBeNull();
        expect(helpers.verifyRefreshToken(jwt.sign(payload, "different-test-key"))).toBeNull();
        expect(helpers.verifyRefreshToken(jwt.sign(payload, refreshSecret, { expiresIn: -1 }))).toBeNull();
    });

    it("throws when signing without a refresh secret and rejects verification", async () => {
        const token = jwt.sign({
            email: "test@example.com", tokenType: "refresh", tokenVersion: 1,
        }, refreshSecret);
        vi.stubEnv("JWT_REFRESH_SECRET", "");
        vi.resetModules();
        const withoutSecret = await import("@/libs/jwt");

        expect(() => withoutSecret.signRefreshToken({ email: "test@example.com" }))
            .toThrow("Missing JWT_REFRESH_SECRET environment variable");
        expect(withoutSecret.verifyRefreshToken(token)).toBeNull();
    });
});
