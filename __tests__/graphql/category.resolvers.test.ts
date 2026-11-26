// @vitest-environment node

import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { categoryResolvers } from "@/graphql/modules/category/resolvers";

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    verifyUser: vi.fn(),
}));

vi.mock("@/models/category.model", () => ({
    CategoryModel: { create: mocks.create },
}));

vi.mock("@/libs/verfiy-user", () => ({ verifyUser: mocks.verifyUser }));

beforeEach(() => {
    vi.resetAllMocks();
});

describe("addCategory document validation", () => {
    it("accepts a saved MongoDB ObjectId and returns the user ID as a string", async () => {
        const userId = new Types.ObjectId();
        const savedCategory = { _id: new Types.ObjectId(), name: "Movies", userId };
        mocks.verifyUser.mockReturnValue({
            success: true,
            _id: userId.toHexString(),
            errors: null,
        });
        mocks.create.mockResolvedValue({
            ...savedCategory,
            toObject: () => savedCategory,
        });

        const result = await categoryResolvers.Mutation.addCategory(
            undefined,
            { name: "Movies" },
            { authHeader: "valid-token" },
        );

        expect(result).toEqual({
            success: true,
            message: "Category added successfully",
            response: { name: "Movies", userId: userId.toHexString() },
            errors: null,
        });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
            name: "Movies",
            userId: userId.toHexString(),
        });
    });
});
