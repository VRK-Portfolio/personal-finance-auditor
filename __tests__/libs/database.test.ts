// @vitest-environment node

import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    connection: { readyState: 0 },
    connect: vi.fn(),
}));

vi.mock("mongoose", () => ({
    default: { connection: mocks.connection, connect: mocks.connect },
}));

const cache = globalThis as typeof globalThis & { mongooseConn?: typeof mongoose };
const previousConnection = cache.mongooseConn;

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017/unit-tests");
    delete cache.mongooseConn;
    mocks.connection.readyState = 0;
    mocks.connect.mockResolvedValue(mongoose);
});

afterEach(() => {
    vi.unstubAllEnvs();
    if (previousConnection === undefined) {
        delete cache.mongooseConn;
    } else {
        cache.mongooseConn = previousConnection;
    }
});

describe("connectDB", () => {
    it("rejects a missing database URI when loading the module", async () => {
        vi.stubEnv("MONGODB_URI", "");

        await expect(import("@/libs/database")).rejects.toThrow("Add MONGODB_URI to .env.local");
        expect(mocks.connect).not.toHaveBeenCalled();
    });

    it("reuses an already connected database without reconnecting", async () => {
        mocks.connection.readyState = 1;
        const { connectDB } = await import("@/libs/database");

        expect(await connectDB()).toBe(mocks.connection);
        expect(mocks.connect).not.toHaveBeenCalled();
    });

    it("connects once and reuses the global connection on subsequent calls", async () => {
        const { connectDB } = await import("@/libs/database");

        expect(await connectDB()).toBe(mongoose);
        expect(await connectDB()).toBe(mongoose);
        expect(mocks.connect).toHaveBeenCalledExactlyOnceWith("mongodb://localhost:27017/unit-tests");
        expect(cache.mongooseConn).toBe(mongoose);
    });

    it("propagates connection errors and allows a later retry", async () => {
        mocks.connect.mockRejectedValueOnce(new Error("Connection refused"));
        const { connectDB } = await import("@/libs/database");

        await expect(connectDB()).rejects.toThrow("Connection refused");
        expect(cache.mongooseConn).toBeUndefined();
        expect(await connectDB()).toBe(mongoose);
        expect(mocks.connect).toHaveBeenCalledTimes(2);
    });
});
