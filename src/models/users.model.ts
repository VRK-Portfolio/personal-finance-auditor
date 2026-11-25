import { signUpType } from "@/schema/auth.schema";
import { model, Model, models, Schema } from "mongoose";

export const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: false },
    role: { type: String, required: false, default: "user" }
}, {
    timestamps: true,
    collection: "users"
})

export const UserModel: Model<signUpType> = models.Users || model<signUpType>("Users", UserSchema);