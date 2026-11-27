import { incomeResolvers } from "./income/resolvers";
import { authResolvers } from "./auth/resolvers";
import { expensesResolvers } from "./expenses/resolvers";
import { categoryResolvers } from "./category/resolvers";
import { savingsResolvers } from "./savings/resolvers";
import { savingCategoryResolvers } from "./savingCategory/resolvers";

export const resolvers = {
    Query: {
        ...incomeResolvers.Query,
        ...expensesResolvers.Query,
        ...categoryResolvers.Query,
        ...savingsResolvers.Query,
        ...savingCategoryResolvers.Query,
    },
    Mutation: {
        ...incomeResolvers.Mutation,
        ...authResolvers.Mutation,
        ...expensesResolvers.Mutation,
        ...categoryResolvers.Mutation,
        ...savingsResolvers.Mutation,
        ...savingCategoryResolvers.Mutation
    }
}