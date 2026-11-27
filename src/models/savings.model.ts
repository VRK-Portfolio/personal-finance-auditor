import mongoose, { Model, models, Schema } from "mongoose";

type SavingsDocument = {
    amount: number;
    savingCategoryId: mongoose.Types.ObjectId;
    savingDate: Date;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

const savingsSchema = new Schema<SavingsDocument>({
    amount: { type: Number, required: true, min: 1 },
    savingCategoryId: { type: Schema.Types.ObjectId, required: true, ref: "SavingCategory", index: true },
    savingDate: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true }
}, {
    timestamps: true,
    collection: "savings"
});

export const SavingsModel: Model<SavingsDocument> = models.Savings || mongoose.model<SavingsDocument>("Savings", savingsSchema);
