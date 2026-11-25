import { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { signAccessToken, verifyAccessToken } from "@/libs/jwt";
import { hashPassword } from "@/libs/password";
import { UserModel } from "@/models/users.model";
import { ApiPostResponse, ApiResponse } from "@/schema/ApiResponse";
import { loginSchema, loginType, signUpSchema, signUpType } from "@/schema/auth.schema";
import { FieldError } from "@/schema/common";
import z from "zod";


export const authResolvers = {
    Mutation: {
        login: async (_parent: unknown, _args: loginType, ctx: GraphQLContext): Promise<ApiResponse<[] | null>> => {
            try {
                const parsed = loginSchema.safeParse(_args);
                if(!parsed.success) {
                    const {fieldErrors} = z.flattenError(parsed.error);
                    const mappedErrors: FieldError[] = mapFieldErrors(fieldErrors);
                    return {
                        success: false,
                        message: "Fields are having an error",
                        errors: mappedErrors,
                        response: null
                    }
                }
                return {
                    success: true,
                    message: "User fetched successfully",
                    response: [],
                    errors: null
                }
            } catch (error: Error | unknown) {
                const errorMssage = error instanceof Error ? error.message : "Unknown error";
                return {
                    success: false,
                    message: "Failed to fetch user",
                    errors: [{ field: "unknown", message: errorMssage }],
                    response: null
                }
            }
        },

        signUp: async (_parent: unknown, _args: signUpType, ctx: GraphQLContext): Promise<ApiPostResponse & { authToken?: string }> =>{
            // Check if the user is already logged in via the auth header
            try {
                // If the user is already logged in, prevent them from signing up again
                if(ctx.authHeader) {
                    const verifyToken = verifyAccessToken(ctx.authHeader);
                    
                    // Verify the access token from the auth header
                    if(verifyToken) {
                        return {
                            success: false,
                            message: "Already Logged In.",
                            errors: null,
                        }
                    }
                }
                const parsed = signUpSchema.safeParse(_args);
                // Validate the sign-up input using the schema
                if(!parsed.success) {
                    const {fieldErrors} = z.flattenError(parsed.error);
                    const mappedErrors: FieldError[] = mapFieldErrors(fieldErrors);
                    return {
                        success: false,
                        message: "Fields are having an error",
                        errors: mappedErrors
                    }
                }
                // Check if the user already exists in the database before creating a new one
                const existingUser = await UserModel.findOne({ email: _args.email });
                if(existingUser) {
                    return {
                        success: false,
                        message: "User already exists",
                        errors: [{ field: "email", message: "Email is already registered" }]
                    }
                }
                const hashedPassword = await hashPassword(_args.password);
                
                const user = await UserModel.create({ ..._args, password: hashedPassword });
                if(!user) {
                    return {
                        success: false,
                        message: "Failed to create user",
                        errors: [{ field: "unknown", message: "User creation failed" }]
                    }
                }
                // Sign the access token for the newly created user
                const token = signAccessToken({ email: _args.email });
                return {
                    success: true,
                    authToken: token,
                    message: "User signed up successfully",
                    errors: null
                }
            } catch (error: Error | unknown) {
                // Handle any unexpected errors during the sign-up process
                const errorMssage = error instanceof Error ? error.message : "Unknown error";
                return {
                    success: false,
                    message: "Failed to sign up user",
                    errors: [{ field: "unknown", message: errorMssage }]
                }
            }

        }
    }
}