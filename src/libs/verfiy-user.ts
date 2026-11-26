import { AuthResponse } from "@/schema/ApiResponse";
import { verifyAccessToken } from "./jwt";


export const verifyUser = (authHeader: string | null): AuthResponse & { _id?: string } => {
    if (!authHeader) {
        return {
            success: false,
            message: "Unauthorized",
            errors: [{ field: "authHeader", message: "Authorization header is missing" }]
        }
    }
    const verifyToken = verifyAccessToken(authHeader);
    // Verify the access token from the authorization header
    if (!verifyToken) {
        return {
            success: false,
            message: "Unauthorized",
            errors: [{ field: "authHeader", message: "Invalid or expired token" }]
        }
    } else {
        return {
            success: true,
            message: "Authorized",
            errors: null,
            _id: verifyToken._id
        }
    }
}