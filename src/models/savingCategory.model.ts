import mongoose, { Model, models, Schema } from "mongoose";

type SavingCategoryDocument = {
    name: string;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

const savingCategorySchema = new Schema<SavingCategoryDocument>({
    name: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true }
}, {
    timestamps: true,
    collection: "savingCategories"
});

export const SavingCategoryModel: Model<SavingCategoryDocument> =
    models.SavingCategory || mongoose.model<SavingCategoryDocument>("SavingCategory", savingCategorySchema);
