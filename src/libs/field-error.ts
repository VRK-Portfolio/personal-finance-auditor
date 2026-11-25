import { FieldError } from "@/schema/common";

export const mapFieldErrors = (fieldErrors: Record<string, string[]>): FieldError[] => {
    return Object.entries(fieldErrors).map(([field, message]) => ({ field, message: message[0] }));
};