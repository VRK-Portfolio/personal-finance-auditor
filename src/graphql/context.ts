// graphql/context.ts
import { connectDB } from "@/libs/database";
import { CommonContextType } from "@/schema/context";
import { NextRequest } from "next/server";

export type GraphQLContext = CommonContextType & {}

export async function buildContext(req: NextRequest): Promise<GraphQLContext> {
  await connectDB();
  return {
    authHeader: req.headers.get("authorization"),
  };
}