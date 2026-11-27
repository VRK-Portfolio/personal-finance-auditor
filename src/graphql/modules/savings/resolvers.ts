import type { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { verifyUser } from "@/libs/verfiy-user";
import { SavingsModel } from "@/models/savings.model";
import { SavingCategoryModel } from "@/models/savingCategory.model";
import { FieldError, idSchema, positiveAmountSchema } from "@/schema/common";
import { z } from "zod";

const savingsInputSchema = z.object({
    amount: positiveAmountSchema,
    savingCategoryId: idSchema,
    savingDate: z.union([z.iso.date(), z.iso.datetime({ offset: true })])
        .transform(value => new Date(value))
});

const updateSavingsInputSchema = savingsInputSchema.partial().refine(
    input => Object.values(input).some(value => value !== undefined),
    { message: "At least one savings field is required", path: ["input"] }
);

type SavingsInput = {
    amount: number;
    savingCategoryId: string;
    savingDate?: string | null;
};

type UpdateSavingsInput = {
    _id: string;
    amount?: number | null;
    savingCategoryId?: string | null;
    savingDate?: string | null;
};

function failure(message: string, errors: FieldError[]) {
    return { success: false, message, response: null, errors };
}

function serializeSavings(savings: NonNullable<Awaited<ReturnType<typeof SavingsModel.findOne>>>) {
    return {
        _id: savings._id.toHexString(),
        userId: savings.userId.toHexString(),
        amount: savings.amount,
        savingCategoryId: savings.savingCategoryId.toHexString(),
        savingDate: savings.savingDate.toISOString(),
        createdAt: savings.createdAt.toISOString(),
        updatedAt: savings.updatedAt.toISOString()
    };
}

export const savingsResolvers = {
    Query: {
        savings: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const savings = await SavingsModel.find({ userId: user._id });
                return {
                    success: true,
                    message: "Savings fetched successfully",
                    response: savings.map(serializeSavings),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch savings", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        savingsById: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid savings ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const savings = await SavingsModel.findOne({ _id: parsedId.data, userId: user._id });
                if (!savings) {
                    return failure("Savings not found", [{ field: "_id", message: "Savings not found" }]);
                }
                return {
                    success: true,
                    message: "Savings fetched successfully",
                    response: serializeSavings(savings),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to fetch savings", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    },
    Mutation: {
        addSavings: async (_parent: unknown, args: SavingsInput, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const input = savingsInputSchema.safeParse({
                    ...args,
                    savingDate: args.savingDate ?? new Date().toISOString()
                });
                if (!input.success) {
                    return failure("Invalid savings input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                const category = await SavingCategoryModel.findOne({
                    _id: input.data.savingCategoryId, userId: user._id
                });
                if (!category) {
                    return failure("Saving category not found", [
                        { field: "savingCategoryId", message: "Saving category not found" }
                    ]);
                }
                const savings = await SavingsModel.create({ ...input.data, userId: user._id });
                return {
                    success: true,
                    message: "Savings added successfully",
                    response: serializeSavings(savings),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to add savings", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        updateSavings: async (_parent: unknown, args: UpdateSavingsInput, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid savings ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const input = updateSavingsInputSchema.safeParse(args);
                if (!input.success) {
                    return failure("Invalid savings input", mapFieldErrors(z.flattenError(input.error).fieldErrors));
                }
                if (input.data.savingCategoryId !== undefined) {
                    const category = await SavingCategoryModel.findOne({
                        _id: input.data.savingCategoryId, userId: user._id
                    });
                    if (!category) {
                        return failure("Saving category not found", [
                            { field: "savingCategoryId", message: "Saving category not found" }
                        ]);
                    }
                }
                const changes = Object.fromEntries(
                    Object.entries(input.data).filter(([, value]) => value !== undefined)
                );
                const savings = await SavingsModel.findOneAndUpdate(
                    { _id: parsedId.data, userId: user._id },
                    { $set: changes },
                    { new: true, runValidators: true }
                );
                if (!savings) {
                    return failure("Savings not found", [{ field: "_id", message: "Savings not found" }]);
                }
                return {
                    success: true,
                    message: "Savings updated successfully",
                    response: serializeSavings(savings),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to update savings", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        },
        deleteSavings: async (_parent: unknown, args: { _id: string }, ctx: GraphQLContext) => {
            try {
                const user = verifyUser(ctx.authHeader);
                if (!user.success || !user._id) {
                    return failure("Unauthorized", user.errors ?? [{ field: "authHeader", message: "User ID is missing" }]);
                }
                const parsedId = idSchema.safeParse(args._id);
                if (!parsedId.success) {
                    return failure("Invalid savings ID", [{ field: "_id", message: "Invalid MongoDB ObjectId" }]);
                }
                const savings = await SavingsModel.findOneAndDelete({ _id: parsedId.data, userId: user._id });
                if (!savings) {
                    return failure("Savings not found", [{ field: "_id", message: "Savings not found" }]);
                }
                return {
                    success: true,
                    message: "Savings deleted successfully",
                    response: serializeSavings(savings),
                    errors: null
                };
            } catch (error: unknown) {
                return failure("Failed to delete savings", [
                    { field: "unknown", message: error instanceof Error ? error.message : "Something went wrong" }
                ]);
            }
        }
    }
};
