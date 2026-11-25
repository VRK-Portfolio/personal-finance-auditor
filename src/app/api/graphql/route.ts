// app/api/graphql/route.ts
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";
import { typeDefs } from "@/graphql/modules/typeDefs";
import { resolvers } from "@/graphql/modules/resolvers";
import { buildContext, GraphQLContext } from "@/graphql/context";

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
});

const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(
  server,
  {
    context: buildContext,
  }
);

export { handler as GET, handler as POST };