import jwt, { type SignOptions } from "jsonwebtoken";

export interface AccessTokenPayload {
  _id: string;
}

export interface RefreshTokenPayload {
  email: string;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_EXPIRES_IN: SignOptions["expiresIn"] = "1h";
const REFRESH_EXPIRES_IN: SignOptions["expiresIn"] = "7d";

function getAccessSecret(): string {
  if (!ACCESS_SECRET) {
    throw new Error("Missing JWT_ACCESS_SECRET environment variable");
  }
  return ACCESS_SECRET;
}

function getRefreshSecret(): string {
  if (!REFRESH_SECRET) {
    throw new Error("Missing JWT_REFRESH_SECRET environment variable");
  }
  return REFRESH_SECRET;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const normalizedEmail = payload._id;
  return jwt.sign(
    { ...payload, _id: normalizedEmail, tokenType: "access" },
    getAccessSecret(),
    { expiresIn: ACCESS_EXPIRES_IN, subject: normalizedEmail }
  );
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const normalizedEmail = payload.email.trim().toLowerCase();
  return jwt.sign(
    { ...payload, email: normalizedEmail, tokenType: "refresh" },
    getRefreshSecret(),
    { expiresIn: REFRESH_EXPIRES_IN, subject: normalizedEmail }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getAccessSecret());
    if (
      typeof decoded === "string" ||
      decoded.tokenType !== "access" ||
      typeof decoded._id !== "string" ||
      !decoded._id
    ) {
      return null;
    }

    return {
      _id: decoded._id.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getRefreshSecret());
    if (
      typeof decoded === "string" ||
      decoded.tokenType !== "refresh" ||
      typeof decoded.email !== "string" ||
      !decoded.email ||
      typeof decoded.tokenVersion !== "number"
    ) {
      return null;
    }

    return {
      email: decoded.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}