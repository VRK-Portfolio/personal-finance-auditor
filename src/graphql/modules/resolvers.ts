import { incomeResolvers } from "./income/resolvers";
import { authResolvers } from "./auth/resolvers";
import { expensesResolvers } from "./expenses/resolvers";
import { categoryResolvers } from "./category/resolvers";

export const resolvers = {
    Query: {
        ...incomeResolvers.Query,
        ...expensesResolvers.Query,
        ...categoryResolvers.Query
    },
    Mutation: {
        ...incomeResolvers.Mutation,
        ...authResolvers.Mutation,
        ...expensesResolvers.Mutation,
        ...categoryResolvers.Mutation
    }
}