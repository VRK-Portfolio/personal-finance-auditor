import { CategoryType } from "@/schema/category.schema";
import { Model, model, models, Schema, Types } from "mongoose";

type CategoryDocument = Omit<CategoryType, 'userId'> & {
    userId: Types.ObjectId;
}
export const categorySchema = new Schema<CategoryDocument>({
    name: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
});

export const CategoryModel: Model<CategoryDocument> = models.Category || model<CategoryDocument>("Category", categorySchema);