// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/graphql/route";

const mocks = vi.hoisted(() => ({
    connectDB: vi.fn(),
    findUser: vi.fn(),
    createUser: vi.fn(),
    findIncome: vi.fn(),
    createIncome: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    signAccessToken: vi.fn(),
    verifyAccessToken: vi.fn(),
}));

vi.mock("@/libs/database", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/models/users.model", () => ({
    UserModel: { findOne: mocks.findUser, create: mocks.createUser },
}));
vi.mock("@/models/income.model", () => ({
    IncomeModel: { find: mocks.findIncome, create: mocks.createIncome },
}));
vi.mock("@/libs/password", () => ({
    hashPassword: mocks.hashPassword,
    verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/libs/jwt", () => ({
    signAccessToken: mocks.signAccessToken,
    verifyAccessToken: mocks.verifyAccessToken,
}));

const loginQuery = `
    mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) { success message authToken }
    }
`;
const credentials = { email: "test@example.com", password: "Secure123!" };

function postRequest(query: string, variables: Record<string, string> = {}, authHeader?: string) {
    return new NextRequest("http://localhost/api/graphql", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify({ query, variables }),
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.findUser.mockResolvedValue({ email: credentials.email, password: "hashed-password" });
    mocks.createUser.mockResolvedValue({ email: credentials.email });
    mocks.findIncome.mockResolvedValue([]);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("hashed-password");
    mocks.signAccessToken.mockReturnValue("test-access-token");
    mocks.verifyAccessToken.mockReturnValue(null);
});

describe("GraphQL HTTP route", () => {
    it("serves the income query through GET with the combined schema", async () => {
        const params = new URLSearchParams({ query: "{ income { success response { _id } } }" });
        const request = new NextRequest(`http://localhost/api/graphql?${params}`, {
            headers: { "apollo-require-preflight": "true" },
        });

        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { income: { success: true, response: [] } },
        });
        expect(mocks.connectDB).toHaveBeenCalledOnce();
        expect(mocks.findIncome).toHaveBeenCalledOnce();
    });

    it("serves login through POST", async () => {
        const response = await POST(postRequest(loginQuery, credentials));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: {
                login: {
                    success: true,
                    message: "Login successful",
                    authToken: "test-access-token",
                },
            },
        });
        expect(mocks.connectDB).toHaveBeenCalledOnce();
        expect(mocks.verifyPassword).toHaveBeenCalledWith(credentials.password, "hashed-password");
    });

    it("serves signup through POST", async () => {
        mocks.findUser.mockResolvedValue(null);
        const response = await POST(postRequest(`
            mutation SignUp($email: String!, $password: String!, $confirmPassword: String!) {
                signUp(email: $email, password: $password, confirmPassword: $confirmPassword) {
                    success authToken
                }
            }
        `, { ...credentials, confirmPassword: credentials.password }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { signUp: { success: true, authToken: "test-access-token" } },
        });
        expect(mocks.createUser).toHaveBeenCalledWith({
            ...credentials,
            confirmPassword: credentials.password,
            password: "hashed-password",
        });
    });

    it("passes the authorization header from HTTP to the auth resolver", async () => {
        mocks.verifyAccessToken.mockReturnValue({ email: credentials.email });

        const response = await POST(postRequest(loginQuery, credentials, "valid-token"));

        expect(await response.json()).toEqual({
            data: {
                login: {
                    success: false,
                    message: "Already Logged In.",
                    authToken: null,
                },
            },
        });
        expect(mocks.verifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(mocks.findUser).not.toHaveBeenCalled();
    });

    it("returns GraphQL errors for invalid operations without database queries", async () => {
        const response = await POST(postRequest("{ nonexistentField }"));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            errors: [
                expect.objectContaining({
                    message: expect.stringContaining('Cannot query field "nonexistentField"'),
                }),
            ],
        });
        expect(mocks.findIncome).not.toHaveBeenCalled();
        expect(mocks.findUser).not.toHaveBeenCalled();
    });

    it("returns an explicit server error when context creation fails", async () => {
        mocks.connectDB.mockRejectedValue(new Error("Database unavailable"));
        const response = await POST(postRequest(loginQuery, credentials));

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
            errors: [
                expect.objectContaining({
                    message: expect.stringContaining("Database unavailable"),
                }),
            ],
        });
        expect(mocks.findUser).not.toHaveBeenCalled();
    });
});
