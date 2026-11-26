import { incomeResolvers } from "./income/resolvers";
import { authResolvers } from "./auth/resolvers";

export const resolvers = {
    Query: {
        ...incomeResolvers.Query,
    },
    Mutation: {
        ...incomeResolvers.Mutation,
        ...authResolvers.Mutation
    }
}