// @vitest-environment node

import { ApolloServer } from "@apollo/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphQLContext } from "@/graphql/context";
import type { AuthResponse } from "@/schema/ApiResponse";
import { authResolvers } from "@/graphql/modules/auth/resolvers";
import { authTypeDefs } from "@/graphql/modules/auth/typeDefs";

const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    create: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    signAccessToken: vi.fn(),
    verifyAccessToken: vi.fn(),
}));

vi.mock("@/models/users.model", () => ({
    UserModel: { findOne: mocks.findOne, create: mocks.create },
}));

vi.mock("@/libs/password", () => ({
    hashPassword: mocks.hashPassword,
    verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/libs/jwt", () => ({
    signAccessToken: mocks.signAccessToken,
    verifyAccessToken: mocks.verifyAccessToken,
}));

type Operation = "login" | "signUp";

const credentials = { email: "test@example.com", password: "Secure123!" };
const signUpInput = { ...credentials, confirmPassword: credentials.password };
const storedUser = { email: credentials.email, password: "hashed-password" };

const mutations = {
    login: `
        mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
                success message authToken errors { field message }
            }
        }
    `,
    signUp: `
        mutation SignUp($email: String!, $password: String!, $confirmPassword: String!) {
            signUp(email: $email, password: $password, confirmPassword: $confirmPassword) {
                success message authToken errors { field message }
            }
        }
    `,
};

const server = new ApolloServer<GraphQLContext>({
    typeDefs: [authTypeDefs, "type Query { _test: Boolean }"],
    resolvers: authResolvers,
});

async function execute(
    operation: Operation,
    variables: Record<string, string> = operation === "login" ? credentials : signUpInput,
    authHeader: string | null = null,
) {
    const response = await server.executeOperation<Record<Operation, AuthResponse>>(
        { query: mutations[operation], variables },
        { contextValue: { authHeader } },
    );

    if (response.body.kind !== "single") {
        throw new Error("Expected a single GraphQL response");
    }

    expect(response.body.singleResult.errors).toBeUndefined();
    const result = response.body.singleResult.data?.[operation];
    if (!result) {
        throw new Error(`Expected data for ${operation}`);
    }
    return result;
}

beforeAll(async () => {
    await server.start();
});

afterAll(async () => {
    await server.stop();
});

beforeEach(() => {
    vi.resetAllMocks();
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockResolvedValue(storedUser);
    mocks.hashPassword.mockResolvedValue(storedUser.password);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.signAccessToken.mockReturnValue("test-access-token");
    mocks.verifyAccessToken.mockReturnValue(null);
});

describe.each(["login", "signUp"] as const)("authResolvers.%s", (operation) => {
    const input = operation === "login" ? credentials : signUpInput;

    it.each([
        ["email", "not-an-email"],
        ["password", "weak"],
    ])("rejects an invalid %s before accessing the database", async (field, value) => {
        const result = await execute(operation, { ...input, [field]: value });

        expect(result).toMatchObject({
            success: false,
            message: "Fields are having an error",
            authToken: null,
        });
        expect(result.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field, message: expect.any(String) }),
        ]));
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });

    it("rejects an already authenticated user before accessing the database", async () => {
        mocks.verifyAccessToken.mockReturnValue({ email: credentials.email });

        const result = await execute(operation, input, "valid-token");

        expect(result).toEqual({
            success: false,
            message: "Already Logged In.",
            errors: null,
            authToken: null,
        });
        expect(mocks.verifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("continues authentication when the supplied token is invalid or expired", async () => {
        if (operation === "login") {
            mocks.findOne.mockResolvedValue(storedUser);
        }

        const result = await execute(operation, input, "invalid-token");

        expect(result.success).toBe(true);
        expect(result.authToken).toBe("test-access-token");
        expect(mocks.verifyAccessToken).toHaveBeenCalledWith("invalid-token");
        expect(mocks.findOne).toHaveBeenCalledWith({ email: credentials.email });
    });

    it("returns a failure response when the database lookup throws", async () => {
        mocks.findOne.mockRejectedValue(new Error("Database unavailable"));

        const result = await execute(operation);

        expect(result).toEqual({
            success: false,
            message: operation === "login" ? "Failed to fetch user" : "Failed to sign up user",
            errors: [{ field: "unknown", message: "Database unavailable" }],
            authToken: null,
        });
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });

    it("rejects a missing required GraphQL variable without calling the resolver", async () => {
        const response = await server.executeOperation(
            { query: mutations[operation], variables: { email: credentials.email } },
            { contextValue: { authHeader: "valid-token" } },
        );

        if (response.body.kind !== "single") {
            throw new Error("Expected a single GraphQL response");
        }

        expect(response.body.singleResult.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringContaining('Variable "$password" of required type "String!"'),
            }),
        ]));
        expect(response.body.singleResult.data).toBeUndefined();
        expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
        expect(mocks.findOne).not.toHaveBeenCalled();
    });
});

describe("authResolvers.login", () => {
    it("returns an access token for valid credentials", async () => {
        mocks.findOne.mockResolvedValue(storedUser);

        const result = await execute("login");

        expect(result).toEqual({
            success: true,
            message: "Login successful",
            errors: null,
            authToken: "test-access-token",
        });
        expect(mocks.findOne).toHaveBeenCalledWith({ email: credentials.email });
        expect(mocks.verifyPassword).toHaveBeenCalledWith(credentials.password, storedUser.password);
        expect(mocks.signAccessToken).toHaveBeenCalledWith(storedUser);
        expect(mocks.verifyAccessToken).not.toHaveBeenCalled();
    });

    it("returns an email error when the user does not exist", async () => {
        const result = await execute("login");

        expect(result).toEqual({
            success: false,
            message: "User not found",
            errors: [{ field: "email", message: "No user found with this email" }],
            authToken: null,
        });
        expect(mocks.verifyPassword).not.toHaveBeenCalled();
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });

    it("returns a password error for incorrect credentials", async () => {
        mocks.findOne.mockResolvedValue(storedUser);
        mocks.verifyPassword.mockResolvedValue(false);

        const result = await execute("login");

        expect(result).toEqual({
            success: false,
            message: "Invalid credentials",
            errors: [{ field: "password", message: "Incorrect password" }],
            authToken: null,
        });
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });
});

describe("authResolvers.signUp", () => {
    it("stores a hashed password and returns an access token for a new user", async () => {
        const result = await execute("signUp");

        expect(result).toEqual({
            success: true,
            message: "User signed up successfully",
            errors: null,
            authToken: "test-access-token",
        });
        expect(mocks.findOne).toHaveBeenCalledWith({ email: credentials.email });
        expect(mocks.hashPassword).toHaveBeenCalledWith(credentials.password);
        expect(mocks.create).toHaveBeenCalledWith({
            ...signUpInput,
            password: storedUser.password,
        });
        expect(mocks.signAccessToken).toHaveBeenCalledWith({ email: credentials.email });
    });

    it("rejects mismatched password confirmation before creating a user", async () => {
        const result = await execute("signUp", {
            ...signUpInput,
            confirmPassword: "Different123!",
        });

        expect(result.success).toBe(false);
        expect(result.authToken).toBeNull();
        expect(result.errors).toEqual([
            { field: "confirmPassword", message: "Passwords do not match" },
        ]);
        expect(mocks.findOne).not.toHaveBeenCalled();
        expect(mocks.hashPassword).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it("rejects an email that is already registered", async () => {
        mocks.findOne.mockResolvedValue(storedUser);

        const result = await execute("signUp");

        expect(result).toEqual({
            success: false,
            message: "User already exists",
            errors: [{ field: "email", message: "Email is already registered" }],
            authToken: null,
        });
        expect(mocks.hashPassword).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });

    it("returns a failure when user creation throws", async () => {
        mocks.create.mockRejectedValue(new Error("User creation failed"));

        const result = await execute("signUp");

        expect(result).toEqual({
            success: false,
            message: "Failed to sign up user",
            errors: [{ field: "unknown", message: "User creation failed" }],
            authToken: null,
        });
        expect(mocks.signAccessToken).not.toHaveBeenCalled();
    });
});
