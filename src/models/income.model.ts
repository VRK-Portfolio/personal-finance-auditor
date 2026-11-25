import { CreateIncomeType } from "@/schema/income.schema";
import mongoose, { Model, models, Schema } from "mongoose";

const incomeSchema = new Schema<CreateIncomeType>({
    amount: { type: Number, required: true },
    source: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now }
}, {
    timestamps: true,
    collection: "income"
})

export const IncomeModel: Model<CreateIncomeType> = models.Income || mongoose.model<CreateIncomeType>("Income", incomeSchema);
