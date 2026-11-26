import type { CreateIncomeType } from "@/schema/income.schema";
import mongoose, { Model, models, Schema } from "mongoose";

type IncomeDocument = Omit<CreateIncomeType, "userId"> & {
    userId: mongoose.Types.ObjectId;
};

const incomeSchema = new Schema<IncomeDocument>({
    amount: { type: Number, required: true },
    source: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true }
}, {
    timestamps: true,
    collection: "income"
})

export const IncomeModel: Model<IncomeDocument> = models.Income || mongoose.model<IncomeDocument>("Income", incomeSchema);
