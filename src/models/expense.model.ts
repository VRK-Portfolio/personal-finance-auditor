import { CreateExpenseType } from "@/schema/expense.schema";
import mongoose, { Model, Schema } from "mongoose";

type ExpenseDocument = Omit<CreateExpenseType, "userId"> & {
    userId: mongoose.Types.ObjectId;
};

export const expenseSchema = new Schema<ExpenseDocument>({
    userId: { type: Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: Date },
    merchant: { type: String },
    description: { type: String }
})

export const ExpenseModel: Model<ExpenseDocument> = mongoose.models.Expense || mongoose.model<ExpenseDocument>("Expense", expenseSchema);