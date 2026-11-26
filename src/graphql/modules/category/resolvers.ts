import { GraphQLContext } from "@/graphql/context";
import { verifyUser } from "@/libs/verfiy-user";
import { CategoryModel, categorySchema } from "@/models/category.model";
import { categoryTypeSchema } from "@/schema/category.schema";
import { idSchema } from "@/schema/common";

export const categoryResolvers = {
    Query: {
        categoryById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return {
                        success: false,
                        message: "Unauthorized",
                        response: null,
                        errors: user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]
                    };
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return {
                        success: false,
                        message: "Invalid category ID",
                        response: null,
                        errors: [{ field: "_id", message: "Invalid MongoDB ObjectId" }]
                    };
                }
                const category = await CategoryModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!category) {
                    return {
                        success: false,
                        message: "Category not found",
                        response: null,
                        errors: [{ field: "_id", message: "Category not found" }]
                    };
                }
                return {
                    success: true,
                    message: "Category fetched successfully",
                    response: {
                        ...category.toObject(),
                        _id: category._id.toHexString(),
                        userId: category.userId.toHexString()
                    },
                    errors: null
                };
            } catch (error: unknown) {
                return {
                    success: false,
                    message: "Failed to fetch category",
                    response: null,
                    errors: [{ field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }]
                };
            }
        },
        categories: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            try {
                const verifyToken = verifyUser(ctx.authHeader);
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        response: null,
                        errors: verifyToken.errors
                    }
                }
                const categories = await CategoryModel.find({ userId: verifyToken._id });
                return {
                    success: true,
                    message: "Categories fetched successfully",
                    response: categories,
                    errors: null
                }
            } catch (error: Error | unknown) {
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        }
    },
    Mutation: {
        addCategory: async (_parent: unknown, args: { name: string }, ctx: GraphQLContext) => {
            // Verify the user before attempting to add a category
            try {
                const verifyToken = verifyUser(ctx.authHeader);
                // If the user verification fails, return an error response
                if (!verifyToken.success) {
                    return {
                        success: false,
                        message: verifyToken.message,
                        response: null,
                        errors: verifyToken.errors
                    }
                }
                // Extract the category name from the arguments
                const { name } = args;
                // Validate that the category name is provided
                if(!name) {
                    return {
                        success: false,
                        message: "Category name is required",
                        response: null,
                        errors: [{ field: "name", message: "Category name is required" }]
                    }
                }
                // Validate that the user ID is available before creating the category
                if (!verifyToken._id) {
                    return {
                        success: false,
                        message: "User ID is required",
                        response: null,
                        errors: [{ field: "userId", message: "User ID is required" }]
                    }
                } else {

                    const categoryList = await CategoryModel.find({ userId: verifyToken._id });
                    // Check if a category with the same name already exists for the user
                    const existingCategory = categoryList.find(category => category.name === name);
                    if (existingCategory) {
                        return {
                            success: false,
                            message: "Category already exists",
                            response: null,
                            errors: [{ field: "name", message: "Category already exists" }]
                        }
                    }
                    // Create a new category in the database with the provided name and user ID
                    const category = await CategoryModel.create({
                        name,
                        userId: verifyToken._id
                    });
                    // Parse and validate the created category against the schema
                    const parsedCategory = categoryTypeSchema.safeParse({
                        ...category.toObject(),
                        userId: category.userId.toHexString()
                    });
                    // If parsing the category fails, return an error response
                    if(!parsedCategory.success) {
                        return {
                            success: false,
                            message: "Failed to parse category",
                            response: null,
                            errors: [{ field: "category", message: "Failed to parse category" }]
                        }
                    }
                    return {
                        success: true,
                        message: "Category added successfully",
                        response: parsedCategory.data,
                        errors: null
                    }
                }
                // Attempt to create a new category in the database
            } catch (error) {
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        },

        updateCategory: async(_parent: unknown, args: { _id: string, name: string }, ctx: GraphQLContext) => {
            try {
                const { _id, name } = args;
                // Validate that the category ID and name are provided
                if(!_id) {
                    return {
                        success: false,
                        message: "Category ID is required",
                        response: null,
                        errors: [{ field: "_id", message: "Category ID is required" }]
                    }
                }
                if(!name) {
                    return {
                        success: false,
                        message: "Category name is required",
                        response: null,
                        errors: [{ field: "name", message: "Category name is required" }]
                    }
                }
                const user = verifyUser(ctx.authHeader);
                if(!user) {
                    return {
                        success: false,
                        message: "Unauthorized",
                        response: null,
                        errors: [{ field: "user", message: "Unauthorized" }]
                    }
                }
                // Update the category in the database
                const updatedCategory = await CategoryModel.findByIdAndUpdate(_id, { name }, { new: true });
                if(!updatedCategory) {
                    return {
                        success: false,
                        message: "Category not found",
                        response: null,
                        errors: [{ field: "_id", message: "Category not found" }]
                    }
                }
                return {
                    success: true,
                    message: "Category updated successfully",
                    response: updatedCategory,
                    errors: null
                }
            } catch(error) {
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        },

        deleteCategory: async(_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const { _id } = args;
                // Validate that the category ID is provided
                if(!_id) {
                    return {
                        success: false,
                        message: "Category ID is required",
                        response: null,
                        errors: [{ field: "_id", message: "Category ID is required" }]
                    }
                }
                // Delete the category from the database
                const deletedCategory = await CategoryModel.findByIdAndDelete(_id);
                if(!deletedCategory) {
                    return {
                        success: false,
                        message: "Category not found",
                        response: null,
                        errors: [{ field: "_id", message: "Category not found" }]
                    }
                }
                return {
                    success: true,
                    message: "Category deleted successfully",
                    response: deletedCategory,
                    errors: null
                }
            } catch (error) {
                return {
                    success: false,
                    message: "Something went wrong",
                    response: null,
                    errors: [error instanceof Error ? error.message : String(error)]
                }
            }
        }
    }
}