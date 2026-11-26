// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext } from "@/graphql/context";

const mocks = vi.hoisted(() => ({ connectDB: vi.fn() }));

vi.mock("@/libs/database", () => ({ connectDB: mocks.connectDB }));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
});

describe("buildContext", () => {
    it("connects to the database and preserves the authorization header", async () => {
        const request = new NextRequest("http://localhost/api/graphql", {
            headers: { authorization: "Bearer test-token" },
        });

        expect(await buildContext(request)).toEqual({ authHeader: "Bearer test-token" });
        expect(mocks.connectDB).toHaveBeenCalledOnce();
    });

    it("uses null when no authorization header is present", async () => {
        const request = new NextRequest("http://localhost/api/graphql");

        expect(await buildContext(request)).toEqual({ authHeader: null });
        expect(mocks.connectDB).toHaveBeenCalledOnce();
    });

    it("propagates a failed database connection", async () => {
        mocks.connectDB.mockRejectedValue(new Error("Connection failed"));

        await expect(buildContext(new NextRequest("http://localhost/api/graphql")))
            .rejects.toThrow("Connection failed");
    });
});
