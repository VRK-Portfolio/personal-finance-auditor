import type { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { verifyUser } from "@/libs/verfiy-user";
import { SavingCategoryModel } from "@/models/savingCategory.model";
import { SavingsModel } from "@/models/savings.model";
import { FieldError, idSchema } from "@/schema/common";
import { z } from "zod";

const categoryInputSchema = z.object({
    name: z.string().trim().min(1, "Saving category name is required")
});

function failure(message: string, errors: FieldError[]) {
    return { success: false, message, response: null, errors };
}

function serializeCategory(category: NonNullable<Awaited<ReturnType<typeof SavingCategoryModel.findOne>>>) {
    return {
        _id: category._id.toHexString(),
        userId: category.userId.toHexString(),
        name: category.name,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString()
    };
}

export const savingCategoryResolvers = {
    Query: {
        savingCategories: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const categories = await SavingCategoryModel.find({ userId: user._id });
                return {
                    success: true,
                    message: "Saving categories fetched successfully",
                    response: categories.map(serializeCategory),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch saving categories", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    },
    Mutation: {
        addSavingCategory: async (_parent: unknown, args: { name: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const input = categoryInputSchema.safeParse(args);
                if (!input.success) {
                    return failure("Invalid saving category input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const category = await SavingCategoryModel.create({ ...input.data, userId: user._id });
                return {
                    success: true,
                    message: "Saving category added successfully",
                    response: serializeCategory(category),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to add saving category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        updateSavingCategory: async (_parent: unknown, args: { _id: string; name: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid saving category ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const input = categoryInputSchema.safeParse(args);
                if (!input.success) {
                    return failure("Invalid saving category input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const category = await SavingCategoryModel.findOneAndUpdate(
                    { _id: parsedId.data, userId: user._id },
                    { $set: input.data },
                    { new: true, runValidators: true }
                );
                if (!category) {
                    return failure("Saving category not found", [{ field: "_id", message: "Saving category not found" }]);
                }
                return {
                    success: true,
                    message: "Saving category updated successfully",
                    response: serializeCategory(category),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to update saving category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        deleteSavingCategory: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid saving category ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const filter = { _id: parsedId.data, userId: user._id };
                const category = await SavingCategoryModel.findOne(filter);
                if (!category) {
                    return failure("Saving category not found", [{ field: "_id", message: "Saving category not found" }]);
                }
                const savings = await SavingsModel.exists({ savingCategoryId: parsedId.data, userId: user._id });
                if (savings) {
                    return failure("Saving category is in use", [
                        { field: "_id", message: "Reassign or delete its savings before deleting this category" }
                    ]);
                }
                const deletedCategory = await SavingCategoryModel.findOneAndDelete(filter);
                if (!deletedCategory) {
                    return failure("Saving category not found", [{ field: "_id", message: "Saving category not found" }]);
                }
                return {
                    success: true,
                    message: "Saving category deleted successfully",
                    response: serializeCategory(deletedCategory),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to delete saving category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    }
};
