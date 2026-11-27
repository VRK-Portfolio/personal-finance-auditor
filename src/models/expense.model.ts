import { CreateExpenseType } from "@/schema/expense.schema";
import mongoose, { Model, Schema } from "mongoose";

type ExpenseDocument = Omit<CreateExpenseType, "userId" | "category" | "date"> & {
    userId: mongoose.Types.ObjectId;
    category: mongoose.Types.ObjectId;
    date?: Date | null;
};

export const expenseSchema = new Schema<ExpenseDocument>({
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    amount: { type: Number, required: true, min: 1 },
    category: { type: Schema.Types.ObjectId, required: true, ref: "Category", index: true },
    date: { type: Date, default: Date.now },
    merchant: { type: String },
    description: { type: String }
})

export const ExpenseModel: Model<ExpenseDocument> = mongoose.models.Expense || mongoose.model<ExpenseDocument>("Expense", expenseSchema);