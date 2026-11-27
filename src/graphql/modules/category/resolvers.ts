import type { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { verifyUser } from "@/libs/verfiy-user";
import { CategoryModel } from "@/models/category.model";
import { ExpenseModel } from "@/models/expense.model";
import { categoryTypeSchema } from "@/schema/category.schema";
import { FieldError, idSchema } from "@/schema/common";
import { z } from "zod";

const categoryInputSchema = categoryTypeSchema.omit({ userId: true });

function failure(message: string, errors: FieldError[]) {
    return { success: false, message, response: null, errors };
}

function serializeCategory(category: NonNullable<Awaited<ReturnType<typeof CategoryModel.findOne>>>) {
    return {
        _id: category._id.toHexString(),
        userId: category.userId.toHexString(),
        name: category.name
    };
}

export const categoryResolvers = {
    Query: {
        categoryById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid category ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const category = await CategoryModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!category) {
                    return failure("Category not found", [{ field: "_id", message: "Category not found" }]);
                }
                return {
                    success: true, message: "Category fetched successfully",
                    response: serializeCategory(category), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        categories: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const categories = await CategoryModel.find({ userId: user._id });
                return {
                    success: true, message: "Categories fetched successfully",
                    response: categories.map(serializeCategory), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch categories", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    },
    Mutation: {
        addCategory: async (_parent: unknown, args: { name: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const input = categoryInputSchema.safeParse(args);
                if (!input.success) {
                    return failure("Invalid category input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const existingCategory = await CategoryModel.findOne({ name: input.data.name, userId: user._id });
                if (existingCategory) {
                    return failure("Category already exists", [{ field: "name", message: "Category already exists" }]);
                }
                const category = await CategoryModel.create({ ...input.data, userId: user._id });
                return {
                    success: true, message: "Category added successfully",
                    response: serializeCategory(category), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to add category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        updateCategory: async (_parent: unknown, args: { _id: string; name: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid category ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const input = categoryInputSchema.safeParse(args);
                if (!input.success) {
                    return failure("Invalid category input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const category = await CategoryModel.findOneAndUpdate(
                    { _id: parsedId.data, userId: user._id },
                    { $set: input.data },
                    { new: true, runValidators: true }
                );
                if (!category) {
                    return failure("Category not found", [{ field: "_id", message: "Category not found" }]);
                }
                return {
                    success: true, message: "Category updated successfully",
                    response: serializeCategory(category), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to update category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        deleteCategory: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid category ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const filter = { _id: parsedId.data, userId: user._id };
                const category = await CategoryModel.findOne(filter);
                if (!category) {
                    return failure("Category not found", [{ field: "_id", message: "Category not found" }]);
                }
                const expenses = await ExpenseModel.exists({ category: parsedId.data, userId: user._id });
                if (expenses) {
                    return failure("Category is in use", [
                        { field: "_id", message: "Reassign or delete its expenses before deleting this category" }
                    ]);
                }
                const deletedCategory = await CategoryModel.findOneAndDelete(filter);
                if (!deletedCategory) {
                    return failure("Category not found", [{ field: "_id", message: "Category not found" }]);
                }
                return {
                    success: true, message: "Category deleted successfully",
                    response: serializeCategory(deletedCategory), errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to delete category", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    }
};
