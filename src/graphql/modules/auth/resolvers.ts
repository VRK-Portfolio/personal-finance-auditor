import { GraphQLContext } from "@/graphql/context";
import { mapFieldErrors } from "@/libs/field-error";
import { signAccessToken, verifyAccessToken } from "@/libs/jwt";
import { hashPassword, verifyPassword } from "@/libs/password";
import { UserModel } from "@/models/users.model";
import { ApiPostResponse, AuthResponse } from "@/schema/ApiResponse";
import { loginSchema, loginType, signUpSchema, signUpType } from "@/schema/auth.schema";
import { FieldError } from "@/schema/common";
import z from "zod";


export const authResolvers = {
    Mutation: {
        login: async (_parent: unknown, _args: loginType, ctx: GraphQLContext): Promise<AuthResponse> => {
            try {
                // If the user is already logged in, prevent them from login again
                if(ctx.authHeader) {
                    const verifyToken = verifyAccessToken(ctx.authHeader);
                    
                    // Verify the access token from the auth header
                    if(verifyToken) {
                        return {
                            success: false,
                            message: "Already Logged In.",
                            errors: null,
                            authToken: undefined,
                        }
                    }
                }
                // Validate the login input using the login schema
                const parsed = loginSchema.safeParse(_args);

                // If the login input is invalid, return the field errors
                if(!parsed.success) {
                    const {fieldErrors} = z.flattenError(parsed.error);
                    const mappedErrors: FieldError[] = mapFieldErrors(fieldErrors);
                    return {
                        success: false,
                        message: "Fields are having an error",
                        errors: mappedErrors,
                        authToken: undefined
                    }
                }
                // Find the user by email in the database
                const login = await UserModel.findOne({ email: _args.email });
                // If the user is not found, return an error
                if(!login) {
                    return {
                        success: false,
                        message: "User not found",
                        errors: [{ field: "email", message: "No user found with this email" }],
                        authToken: undefined
                    }
                } else {
                    // Verify the user's password
                    const isPasswordValid = await verifyPassword(_args.password, login.password);
                    // If the password is invalid, return an error
                    if(!isPasswordValid) {
                        return {
                            success: false,
                            message: "Invalid credentials",
                            errors: [{ field: "password", message: "Incorrect password" }],
                            authToken: undefined
                        }

                    } else {
                        // If the password is valid, generate an auth token and return success
                        const authToken = signAccessToken(login);
                        return {
                            success: true,
                            message: "Login successful",
                            errors: null,
                            authToken
                        }
                    }
                }
            } catch (error: Error | unknown) {
                const errorMssage = error instanceof Error ? error.message : "Unknown error";
                return {
                    success: false,
                    message: "Failed to fetch user",
                    errors: [{ field: "unknown", message: errorMssage }],
                    authToken: undefined
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
                            authToken: undefined,
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
                        errors: mappedErrors,
                        authToken: undefined
                    }
                }
                // Check if the user already exists in the database before creating a new one
                const existingUser = await UserModel.findOne({ email: _args.email });
                if(existingUser) {
                    return {
                        success: false,
                        message: "User already exists",
                        errors: [{ field: "email", message: "Email is already registered" }],
                        authToken: undefined
                    }
                }
                const hashedPassword = await hashPassword(_args.password);
                
                const user = await UserModel.create({ ..._args, password: hashedPassword });
                if(!user) {
                    return {
                        success: false,
                        message: "Failed to create user",
                        errors: [{ field: "unknown", message: "User creation failed" }],
                        authToken: undefined
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
                    errors: [{ field: "unknown", message: errorMssage }],
                    authToken: undefined
                }
            }

        }
    }
}