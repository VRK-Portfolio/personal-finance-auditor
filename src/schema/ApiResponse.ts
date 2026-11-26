import { FieldError } from "./common";

export type ApiResponse<T> = {
    success: boolean;
    message: string;
    response:T;
    errors: FieldError[] | null;
};


export type ApiPostResponse = {
    success: boolean;
    message: string;
    errors: FieldError[] | null;
};


export type AuthResponse = {
    success: boolean;
    message: string;
    errors: FieldError[] | null;
    authToken?: string;
}